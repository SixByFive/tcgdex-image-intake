'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4102', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  apiKey: process.env.API_KEY,

  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),

  tempUploadDir: process.env.TEMP_UPLOAD_DIR || '/tmp/tcgdex-image-intake/uploads',
  tempExtractDir: process.env.TEMP_EXTRACT_DIR || '/tmp/tcgdex-image-intake/extracted',

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://minio:9000',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucketName: process.env.MINIO_BUCKET_NAME || 'tcgdex-images',
  },

  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [],
};

function validateConfig() {
  const required = [
    ['API_KEY', config.apiKey],
    ['MINIO_ACCESS_KEY', config.minio.accessKey],
    ['MINIO_SECRET_KEY', config.minio.secretKey],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
