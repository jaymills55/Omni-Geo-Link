import express from 'express';
import cors from 'cors';
import { Worker, isMainThread, parentPort } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { createRequire } from 'module';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import stream from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================================================
// THE COMMONJS BRIDGE
// =========================================================
const require = createRequire(import.meta.url);
const archiverModule = require('archiver');
// This manually unwraps the object Node creates so it is guaranteed to be a function
const createArchive = archiverModule.default || archiverModule;

// =========================================================
// THREAD SPLITTING LOGIC
// =========================================================
if (isMainThread) {
    
    // ---------------------------------------------------------
    // MAIN EXPRESS SERVER THREAD
    // ---------------------------------------------------------
    const app = express();
    const PORT = process.env.PORT || 8080;

    app.set('trust proxy', true);
    app.use(express.json());
    
    app.use(cors({
        origin: ['http://localhost:5173'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true
    }));

    app.post('/api/generate-batch', async (req, res) => {
        const { clientId, batchVolume, destinationUrl, routingTier } = req.body;
        
        if (!batchVolume || batchVolume > 500) {
            return res.status(400).json({ error: 'Invalid volume. Maximum batch size is 500.' });
        }
        
        const batchId = Date.now();
        let generatedLinks = [];
        
        for (let i = 0; i < batchVolume; i++) {
            const randomSlug = Math.random().toString(36).substring(2, 8);
            generatedLinks.push({ slug: randomSlug, destination_url: destinationUrl });
        }
        
        const worker = new Worker(__filename);
        worker.postMessage({ batchId, links: generatedLinks });
        
        worker.on('message', async (message) => {
            if (message.success) {
                console.log(`[Batch ${message.batchId}] S3 Upload Complete: ${message.s3Key}`);
            } else {
                console.error(`[Batch ${message.batchId}] Worker Failed:`, message.error);
            }
        });
        
        worker.on('error', (err) => console.error('Worker Thread Crashed:', err));

        return res.status(202).json({
            success: true,
            message: 'Batch accepted and processing in the background.',
            batchId: batchId
        });
    });

    app.get('/system/health', (req, res) => res.status(200).send('OK'));

    app.listen(PORT, () => {
        console.log(`[Omni Analytix] Server running smoothly on port ${PORT}`);
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
            
            // Using the safely unwrapped function
            const archive = createArchive('zip', { zlib: { level: 9 } });
            
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
