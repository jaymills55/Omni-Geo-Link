import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import JSZip from 'jszip'; // Switched to jszip
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import stream from 'stream';

const app = express();
const PORT = process.env.PORT || 8080;

app.set('trust proxy', true);
app.use(express.json());

app.use(cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy',
    }
});

app.post('/api/generate-batch', async (req, res) => {
    const { destinationUrl, batchVolume } = req.body;
    
    if (!destinationUrl) {
        return res.status(400).json({ error: 'Missing destination URL.' });
    }
    
    const batchId = Date.now();
    let generatedLinks = [];
    for (let i = 0; i < batchVolume; i++) {
        generatedLinks.push({ slug: Math.random().toString(36).substring(2, 8), destination_url: destinationUrl });
    }
    
    res.status(202).json({ success: true, batchId: batchId });

    // The Floating Promise: Process zip in background
    (async () => {
        try {
            console.log(`[Batch ${batchId}] Starting JSZip background processing...`);
            
            const zip = new JSZip();
            
            // Add QR codes to zip
            await Promise.all(generatedLinks.map(async (link, index) => {
                const qrBuffer = await QRCode.toBuffer(link.destination_url || 'https://omni-analytix.com', { 
                    errorCorrectionLevel: 'M',
                    margin: 2
                });
                zip.file(`${link.slug}.png`, qrBuffer);
            }));

            // Generate zip as a stream
            const fileName = `batches/omni_batch_${batchId}.zip`;
            const zipStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true });
            
            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: process.env.AWS_BUCKET_NAME || 'omni-analytix-batches-prod',
                    Key: fileName,
                    Body: zipStream,
                    ContentType: 'application/zip'
                }
            });

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
