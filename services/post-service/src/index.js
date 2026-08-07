if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/db.js';
import postRoutes from './routes/post.routes.js';
import reelRoutes from './routes/reel.routes.js';
import groupRoutes from './routes/group.routes.js';
import storyRoutes from './routes/story.routes.js';
import prisma from './config/db.js';

const app = express();

// Disable ETag generation to prevent 304 Not Modified responses
app.set('etag', false);

app.use(cors());
app.use(express.json());

// Custom HTTP Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Cache Control Middleware to prevent client caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/', postRoutes);
app.use('/', reelRoutes);
app.use('/', groupRoutes);
app.use('/', storyRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in Post Service:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in Post Service'
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database then start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Post Service is running on port ${PORT}`);
  });

  // Cleanup story đã hết hạn mỗi 1 giờ
  const CLEANUP_INTERVAL = 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await prisma.story.deleteMany({
        where: { expires_at: { lt: new Date() } }
      });
      if (result.count > 0) {
        console.log(`🧹 Cleaned up ${result.count} expired stories`);
      }
    } catch (err) {
      console.error('❌ Story cleanup error:', err.message);
    }
  }, CLEANUP_INTERVAL);
});

