import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import QRCode from 'qrcode';
import Database from 'better-sqlite3';
import geoip from 'geoip-lite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'database.sqlite')
  : path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Create the omni_links table if it doesn't exist
// Force drop for local QA testing to ensure clean schema
db.exec('DROP TABLE IF EXISTS omni_links');

db.exec(`
  CREATE TABLE IF NOT EXISTS omni_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    custom_domain TEXT,
    scan_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Safe migration for new Tier 2 geo-fencing columns
try {
  db.exec('ALTER TABLE omni_links ADD COLUMN geo_active INTEGER DEFAULT 0');
  db.exec('ALTER TABLE omni_links ADD COLUMN target_region TEXT');
  db.exec('ALTER TABLE omni_links ADD COLUMN alternate_url TEXT');
} catch (e) {
  // Columns already exist
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // === API ROUTER (GUARANTEED TO EXECUTE FIRST) ===
  const apiRouter = express.Router();

  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  apiRouter.get('/admin/metrics', (req, res) => {
    try {
      const stmt = db.prepare('SELECT slug, long_url, custom_domain, scan_count, created_at FROM omni_links ORDER BY created_at DESC');
      const rows = stmt.all();
      res.json({ metrics: rows });
    } catch (error) {
      console.error('Metrics Error:', error);
      res.status(500).json({ error: 'Failed to retrieve metrics' });
    }
  });

  apiRouter.post('/generate', async (req, res) => {
    const { longUrl, geoActive, targetRegion, alternateUrl } = req.body;
    if (!longUrl) {
      return res.status(400).json({ error: 'Missing longUrl' });
    }

    try {
      const slug = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Dynamic Base URL
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
      const shortUrl = `${baseUrl.replace(/\/$/, '')}/${slug}`;
      
      const qrBase64 = await QRCode.toDataURL(shortUrl, {
        color: {
          dark: '#FFFF00', // Omni Yellow
          light: '#00000000' // Transparent
        },
        margin: 1,
        width: 120
      });

      // Insert into database
      const insertStmt = db.prepare('INSERT INTO omni_links (slug, long_url, geo_active, target_region, alternate_url) VALUES (?, ?, ?, ?, ?)');
      insertStmt.run(slug, longUrl, geoActive ? 1 : 0, targetRegion || null, alternateUrl || null);

      res.json({ slug, shortUrl, qrBase64 });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate Omni-Link' });
    }
  });

  // Mount API router strictly at /api BEFORE any other routes
  app.use('/api', apiRouter);

  // === REDIRECT CONTROLLER ===
  app.get('/:slug', (req, res, next) => {
    const { slug } = req.params;
    
    // Ignore common internal Vite/React paths
    if (slug === 'api' || slug.includes('.')) {
      return next();
    }
    
    try {
      const stmt = db.prepare('SELECT long_url, geo_active, target_region, alternate_url FROM omni_links WHERE slug = ?');
      const link = stmt.get(slug) as { long_url: string, geo_active: number, target_region: string | null, alternate_url: string | null } | undefined;

      if (link) {
        // Increment scan count
        const updateStmt = db.prepare('UPDATE omni_links SET scan_count = scan_count + 1 WHERE slug = ?');
        updateStmt.run(slug);
        
        // Tier 2 Geo-Fencing Logic
        let destination = link.long_url;
        
        const isGeoActive = link.geo_active === 1 || link.geo_active === true || link.geo_active === 'true';

        if (isGeoActive && link.target_region && link.alternate_url) {
          const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
          // Clean comma-separated proxy IPs
          const cleanIp = ip.split(',')[0].trim();
          const geo = geoip.lookup(cleanIp);

          if (geo && geo.region === link.target_region) {
            destination = link.alternate_url;
          }
        }
        
        // 301 Redirect to computed destination
        return res.redirect(301, destination);
      } else {
        // Fall back to frontend routing if not found in database
        return next();
      }
    } catch (error) {
      console.error('Redirect Error:', error);
      return next();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
