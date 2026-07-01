import express from 'express';
import cors from 'cors';
import batchRouter from './api/batch-controller.js'; // The only file we know actually exists

const app = express();

// The CORS gate to allow your React app to connect
app.use(cors({
    origin: ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json());

// The ONLY active route
app.use('/api', batchRouter);

// The Engine Ignition
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`[Omni Analytix] Server running securely on port ${PORT}`);
});
