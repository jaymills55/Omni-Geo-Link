import express from 'express';
import cors from 'cors';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import geoip from 'geoip-lite';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { createRequire } from 'module';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import stream from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const archiver = require('archiver');

// =========================================================
// DATABASE BOOTSTRAP (Runs securely on every startup)
// =========================================================
export const db = await open({ filename: './database.sqlite', driver: sqlite3.Database });

await db.exec(`
    CREATE TABLE IF NOT EXISTS omni_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        destination_url TEXT NOT NULL,
        priority_tier TEXT DEFAULT 'tier1',
        geo_fencing_active INTEGER DEFAULT 0,
        target_region TEXT,
        target_zip TEXT,
        radius INTEGER,
        time_fencing_active INTEGER DEFAULT 0,
        start_window DATETIME,
        end_window DATETIME,
        alternate_url TEXT,
        device_routing_active INTEGER DEFAULT 0,
        ios_url TEXT,
        android_url TEXT,
        ab_split_active INTEGER DEFAULT 0,
        variant_b_url TEXT,
        traffic_split INTEGER DEFAULT 50,
        pixel_active INTEGER DEFAULT 0,
        meta_pixel_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        batch_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS batch_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT,
        status TEXT,
        created_at DATETIME,
        s3_key TEXT
    );

    CREATE TABLE IF NOT EXISTS telemetry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug_scanned TEXT,
        visitor_ip TEXT,
        visitor_state TEXT,
        visitor_city TEXT,
        visitor_zip TEXT,
        device_os TEXT,
        route_reason TEXT,
        scanned_at DATETIME
    );
`);

// Gracefully handle column additions in case of existing schema
try { await db.exec('ALTER TABLE omni_links ADD COLUMN batch_id INTEGER;'); } catch (e) { /* Ignore duplicate */ }

// =========================================================
// THREAD SPLITTING LOGIC
// =========================================================
if (isMainThread) {
    
    // ---------------------------------------------------------
    // MAIN EXPRESS SERVER THREAD
    // ---------------------------------------------------------
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.set('trust proxy', true);
    app.use(express.json());
    app.use(cors({
        origin: ['http://localhost:5173', 'https://your-future-frontend-domain.com'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
    }));

    // ---------------------------------------------------------
    // ENDPOINT: BATCH GENERATION (/api/generate-batch)
    // ---------------------------------------------------------
    app.post('/api/generate-batch', async (req, res) => {
        const { clientId, batchVolume, destinationUrl, routingTier } = req.body;
        
        if (!batchVolume || batchVolume > 500) {
            return res.status(400).json({ error: 'Invalid volume. Maximum batch size is 500.' });
        }
        
        let batchId;
        let generatedLinks = [];
        
        try {
            await db.run('BEGIN TRANSACTION');
            const batchResult = await db.run(
                `INSERT INTO batch_jobs (client_id, status, created_at) VALUES (?, 'PROCESSING', DATETIME('now'))`,
                [clientId]
            );
            batchId = batchResult.lastID;
            
            for (let i = 0; i < batchVolume; i++) {
                const randomSlug = Math.random().toString(36).substring(2, 8);
                await db.run(
                    `INSERT INTO omni_links (slug, destination_url, priority_tier, batch_id) VALUES (?, ?, ?, ?)`,
                    [randomSlug, destinationUrl, routingTier, batchId]
                );
                generatedLinks.push({ slug: randomSlug, destination_url: destinationUrl });
            }
            await db.run('COMMIT');
        } catch (error) {
            await db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to secure batch data. Transaction rolled back.' });
        }
        
        // Spawn worker dynamically from THIS SAME FILE
        const worker = new Worker(__filename);
        worker.postMessage({ batchId, links: generatedLinks });
        
        worker.on('message', async (message) => {
            if (message.success) {
                console.log(`[Batch ${message.batchId}] S3 Upload Complete: ${message.s3Key}`);
                await db.run(`UPDATE batch_jobs SET status = 'COMPLETED', s3_key = ? WHERE id = ?`, [message.s3Key, message.batchId]);
            } else {
                console.error(`[Batch ${message.batchId}] Worker Failed:`, message.error);
                await db.run(`UPDATE batch_jobs SET status = 'FAILED' WHERE id = ?`, [message.batchId]);
            }
        });
        worker.on('error', (err) => console.error('Worker Thread Crashed:', err));

        return res.status(202).json({
            success: true,
            message: 'Batch accepted and processing in the background.',
            batchId: batchId
        });
    });

    // ---------------------------------------------------------
    // ENDPOINT: CREATE LINK (/api/create-link)
    // ---------------------------------------------------------
    app.post('/api/create-link', async (req, res) => {
        let { slug, destination_url, routing_tier, geo_fencing_active, target_region, target_zip, radius, time_fencing_active, start_window, end_window, alternate_url, device_routing_active, ios_url, android_url, ab_split_active, variant_b_url, traffic_split, pixel_active, meta_pixel_id } = req.body;
        
        try {
            if (!slug || slug.trim() === '') {
                let isUnique = false;
                while (!isUnique) {
                    slug = crypto.randomBytes(6).toString('base64url').substring(0, 6);
                    const existing = await db.get('SELECT slug FROM omni_links WHERE slug = ?', [slug]);
                    if (!existing) isUnique = true;
                }
            } else {
                const existing = await db.get('SELECT slug FROM omni_links WHERE slug = ?', [slug]);
                if (existing) return res.status(409).json({ error: 'Slug already in use.' });
            }

            await db.run(`
                INSERT INTO omni_links (
                    slug, destination_url, priority_tier,
                    geo_fencing_active, target_region, target_zip, radius,
                    time_fencing_active, start_window, end_window, alternate_url,
                    device_routing_active, ios_url, android_url,
                    ab_split_active, variant_b_url, traffic_split,
                    pixel_active, meta_pixel_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                slug, destination_url, routing_tier || 'tier1',
                geo_fencing_active ? 1 : 0, target_region || null, target_zip || null, radius || null,
                time_fencing_active ? 1 : 0, start_window || null, end_window || null, alternate_url || null,
                device_routing_active ? 1 : 0, ios_url || null, android_url || null,
                ab_split_active ? 1 : 0, variant_b_url || null, traffic_split || 50,
                pixel_active ? 1 : 0, meta_pixel_id || null
            ]);
            
            res.status(201).json({ success: true, slug, short_url: `http://localhost:3000/${slug}` });
        } catch (err) {
            res.status(500).json({ error: 'Failed to create link' });
        }
    });

    // ---------------------------------------------------------
    // ENDPOINT: GET ALL LINKS (/api/links)
    // ---------------------------------------------------------
    app.get('/api/links', async (req, res) => {
        try {
            const links = await db.all('SELECT * FROM omni_links ORDER BY created_at DESC');
            res.status(200).json(links);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch links' });
        }
    });

    // ---------------------------------------------------------
    // ENDPOINT: GET LINK BY SLUG (/api/links/:slug)
    // ---------------------------------------------------------
    app.get('/api/links/:slug', async (req, res) => {
        try {
            const link = await db.get('SELECT * FROM omni_links WHERE slug = ?', [req.params.slug]);
            if (!link) return res.status(404).json({ error: 'Link not found' });
            res.status(200).json(link);
        } catch (err) {
            res.status(500).json({ error: 'Database error' });
        }
    });

    // ---------------------------------------------------------
    // ENDPOINT: ANALYTICS (/api/analytics/:slug)
    // ---------------------------------------------------------
    app.get('/api/analytics/:slug', async (req, res) => {
        const { slug } = req.params;
        try {
            const totalQuery = await db.get('SELECT COUNT(*) as count FROM telemetry_logs WHERE slug_scanned = ?', [slug]);
            const routeQuery = await db.all('SELECT route_reason, COUNT(*) as count FROM telemetry_logs WHERE slug_scanned = ? GROUP BY route_reason ORDER BY count DESC', [slug]);
            const geoQuery = await db.all("SELECT visitor_state, COUNT(*) as count FROM telemetry_logs WHERE slug_scanned = ? AND visitor_state IS NOT NULL AND visitor_state != 'Unknown' GROUP BY visitor_state ORDER BY count DESC LIMIT 5", [slug]);
            res.status(200).json({ slug, totalScans: totalQuery.count, routeBreakdown: routeQuery, topGeographies: geoQuery });
        } catch (err) {
            res.status(500).json({ error: 'Failed to aggregate telemetry data.' });
        }
    });

    // ---------------------------------------------------------
    // VISITOR MIDDLEWARE (Telemetry & Geo)
    // ---------------------------------------------------------
    const visitorMiddleware = async (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        req.visitorData = { ip, state: 'Unknown', city: 'Unknown', zip: 'Unknown', deviceOS: 'Unknown' };
        
        const geo = geoip.lookup(ip);
        if (geo) {
            req.visitorData.state = geo.region;
            req.visitorData.city = geo.city;
            req.visitorData.zip = geo.zip;
        }

        const ua = req.headers['user-agent'] || '';
        if (/android/i.test(ua)) req.visitorData.deviceOS = 'Android';
        else if (/ipad|iphone|ipod/i.test(ua)) req.visitorData.deviceOS = 'iOS';
        else req.visitorData.deviceOS = 'Desktop';

        next();
    };

    // ---------------------------------------------------------
    // ENDPOINT: RESOLVE LINK (/:slug)
    // ---------------------------------------------------------
    app.get('/:slug', visitorMiddleware, async (req, res) => {
        const { slug } = req.params;
        try {
            const linkData = await db.get('SELECT * FROM omni_links WHERE slug = ?', [slug]);
            if (!linkData) return res.status(404).send('Link not found');

            let finalUrl = linkData.destination_url;
            let routeReason = 'Tier 1 Standard';

            if (linkData.priority_tier === 'tier2') {
                const now = new Date();
                const start = linkData.start_window ? new Date(linkData.start_window) : null;
                const end = linkData.end_window ? new Date(linkData.end_window) : null;
                
                if ((start && now < start) || (end && now > end)) {
                    finalUrl = linkData.alternate_url;
                    routeReason = 'Tier 2 Time Deflection';
                } else if (linkData.geo_fencing_active && linkData.target_region) {
                    if (req.visitorData.state !== linkData.target_region && req.visitorData.state !== 'Unknown') {
                        finalUrl = linkData.alternate_url;
                        routeReason = 'Tier 2 Geo Deflection';
                    }
                }
            }

            if (linkData.priority_tier === 'tier3') {
                if (linkData.device_routing_active) {
                    if (req.visitorData.deviceOS === 'iOS' && linkData.ios_url) {
                        finalUrl = linkData.ios_url;
                        routeReason = 'Tier 3 OS Routing (iOS)';
                    } else if (req.visitorData.deviceOS === 'Android' && linkData.android_url) {
                        finalUrl = linkData.android_url;
                        routeReason = 'Tier 3 OS Routing (Android)';
                    }
                } else if (linkData.ab_split_active) {
                    const rand = Math.random() * 100;
                    if (rand > linkData.traffic_split) {
                        finalUrl = linkData.variant_b_url;
                        routeReason = 'Tier 3 A/B Split (Variant B)';
                    } else {
                        routeReason = 'Tier 3 A/B Split (Variant A)';
                    }
                }
            }

            await db.run(
                `INSERT INTO telemetry_logs (slug_scanned, visitor_ip, visitor_state, visitor_city, visitor_zip, device_os, route_reason, scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now'))`,
                [slug, req.visitorData.ip, req.visitorData.state, req.visitorData.city, req.visitorData.zip, req.visitorData.deviceOS, routeReason]
            );

            if (linkData.pixel_active && linkData.meta_pixel_id) {
                const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <script>
                        !function(f,b,e,v,n,t,s)
                        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                        n.queue=[];t=b.createElement(e);t.async=!0;
                        t.src=v;s=b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t,s)}(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');
                        fbq('init', '${linkData.meta_pixel_id}');
                        fbq('track', 'PageView');
                        setTimeout(function() { window.location.href = '${finalUrl}'; }, 1000);
                        </script>
                    </head>
                    <body style="background:#000; color:#fff; font-family:monospace; display:flex; justify-content:center; align-items:center; height:100vh;">
                        <p>Authenticating connection...</p>
                    </body>
                    </html>
                `;
                return res.send(html);
            }

            return res.redirect(302, finalUrl);

        } catch (err) {
            console.error('Resolve Link Error:', err);
            res.status(500).send('Internal Server Error');
        }
    });

    app.get('/system/health', (req, res) => res.status(200).send('OK'));

    app.listen(PORT, () => {
        console.log(`Monolithic Omni Geo Link server is running on port ${PORT}`);
    });

} else {
    
    // ---------------------------------------------------------
    // BACKGROUND WORKER THREAD (QR Batching & S3 Upload)
    // ---------------------------------------------------------
    const s3 = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
        }
    });

    parentPort.on('message', async ({ batchId, links }) => {
        try {
            const passThroughStream = new stream.PassThrough();
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            archive.on('error', err => { throw err; });
            archive.pipe(passThroughStream);

            const fileName = `batches/omni_batch_${batchId}.zip`;
            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: process.env.AWS_BUCKET_NAME || 'omni-batch-bucket',
                    Key: fileName,
                    Body: passThroughStream,
                    ContentType: 'application/zip'
                }
            });

            const qrPromises = links.map(async (link, index) => {
                const qrBuffer = await QRCode.toBuffer(link.destination_url, { 
                    errorCorrectionLevel: 'H',
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                });
                const qrFileName = `${link.slug || 'omni_qr_' + index}.png`;
                archive.append(qrBuffer, { name: qrFileName });
            });

            await Promise.all(qrPromises);
            await archive.finalize();
            await upload.done();

            parentPort.postMessage({ success: true, batchId, s3Key: fileName });
        } catch (error) {
            console.error(`[Worker Error] Batch ${batchId} failed:`, error);
            parentPort.postMessage({ success: false, batchId, error: error.message });
        }
    });
}
