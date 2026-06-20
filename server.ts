import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import QRCode from 'qrcode';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'database.sqlite')
  : path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Create the omni_links table if it doesn't exist
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
    const { longUrl } = req.body;
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
      const insertStmt = db.prepare('INSERT INTO omni_links (slug, long_url) VALUES (?, ?)');
      insertStmt.run(slug, longUrl);

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
      const stmt = db.prepare('SELECT long_url FROM omni_links WHERE slug = ?');
      const row = stmt.get(slug) as { long_url: string } | undefined;

      if (row) {
        // Increment scan count
        const updateStmt = db.prepare('UPDATE omni_links SET scan_count = scan_count + 1 WHERE slug = ?');
        updateStmt.run(slug);
        
        // 301 Redirect to destination
        return res.redirect(301, row.long_url);
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
