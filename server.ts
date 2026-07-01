import express from 'express';
import { visitorMiddleware } from './api/middleware.js';
import { resolveLink } from './api/link-handler.js';
import { createLink } from './api/create-link.js';
import { getAllLinks, getLinkBySlug } from './api/get-link.js';
import { getAssetAnalytics } from './api/analytics.js';
import batchHandler from './api/batch-handler.js';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if running behind a load balancer/reverse proxy
app.set('trust proxy', true);

// Parse incoming JSON payloads
app.use(express.json());

// Enable CORS for frontend connectivity
app.use(cors({
    origin: ['http://localhost:5173', 'https://your-future-frontend-domain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

// Mount the routes
app.use('/api', batchHandler);
app.post('/api/create-link', createLink);
app.get('/api/links', getAllLinks);
app.get('/api/links/:slug', getLinkBySlug);
app.get('/api/analytics/:slug', getAssetAnalytics);
app.get('/:slug', visitorMiddleware, resolveLink);

// Health check endpoint
app.get('/system/health', (req, res) => {
    res.status(200).send('OK');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Omni Geo Link server is running on port ${PORT}`);
});
