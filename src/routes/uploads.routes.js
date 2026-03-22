'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { uploadRateLimit } = require('../middleware/rateLimit.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');
const { uploadCardImagesController } = require('../controllers/uploads.controller');

const router = express.Router();

router.post(
  '/card-images',
  authMiddleware,
  uploadRateLimit,
  uploadMiddleware,
  uploadCardImagesController
);

module.exports = router;
