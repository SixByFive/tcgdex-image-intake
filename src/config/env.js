'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4102', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  apiKey: process.env.API_KEY,

  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),

  tempUploadDir: process.env.TEMP_UPLOAD_DIR || '/tmp/tcgdex-image-intake/uploads',
  tempExtractDir: process.env.TEMP_EXTRACT_DIR || '/tmp/tcgdex-image-intake/extracted',

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucketName: process.env.S3_BUCKET_NAME,
  },

  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, ''))
    : [],
};

function validateConfig() {
  const required = [
    ['API_KEY', config.apiKey],
    ['S3_ENDPOINT', config.s3.endpoint],
    ['S3_ACCESS_KEY', config.s3.accessKey],
    ['S3_SECRET_KEY', config.s3.secretKey],
    ['S3_BUCKET_NAME', config.s3.bucketName],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
