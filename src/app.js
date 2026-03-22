'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { config } = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Security headers
app.use(helmet());

// CORS — locked to configured origins
app.use(
  cors({
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : false,
    methods: ['GET', 'POST'],
  })
);

// Body parsing for non-multipart fields
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/uploads', uploadsRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Global error handler — must be last
app.use(errorMiddleware);

module.exports = app;
