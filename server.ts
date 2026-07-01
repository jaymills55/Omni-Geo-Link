import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import { createRequire } from 'module';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import stream from 'stream';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 8080;

app.set('trust proxy', true);
app.use(express.json());

// The CORS Gate
app.use(cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// AWS Credentials Bridge
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
    }
});

// ---------------------------------------------------------
// ENDPOINT: BATCH GENERATION
// ---------------------------------------------------------
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
    
    // 1. Respond to the frontend
    res.status(202).json({
        success: true,
        message: 'Batch accepted and processing in the background.',
        batchId: batchId
    });

    // 2. Process in background
    (async () => {
        try {
            console.log(`[Batch ${batchId}] Starting background processing...`);
            const passThroughStream = new stream.PassThrough();
            
            // Resolve archiver as a function or object property
            const archiverFn = (typeof archiver === 'function') ? archiver : (archiver.create || archiver.default);
            const archive = archiverFn('zip', { zlib: { level: 9 } });
            
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

            const qrPromises = generatedLinks.map(async (link, index) => {
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

            console.log(`[Batch ${batchId}] S3 Upload Complete: ${fileName}`);
        } catch (error) {
            console.error(`[Background Error] Batch ${batchId} failed:`, error);
        }
    })();
});

app.get('/system/health', (req, res) => res.status(200).send('OK'));

app.listen(PORT, () => {
    console.log(`[Omni Analytix] Server running securely on port ${PORT}`);
});
