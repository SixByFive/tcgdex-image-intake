'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '4102', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  apiKey: process.env.API_KEY,

  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || '100', 10),

  tempUploadDir: process.env.TEMP_UPLOAD_DIR || '/tmp/tcgdex-image-intake/uploads',
  tempExtractDir: process.env.TEMP_EXTRACT_DIR || '/tmp/tcgdex-image-intake/extracted',

  google: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined,
    driveRootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
  },

  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [],
};

function validateConfig() {
  const required = [
    ['API_KEY', config.apiKey],
    ['GOOGLE_SERVICE_ACCOUNT_EMAIL', config.google.serviceAccountEmail],
    ['GOOGLE_PRIVATE_KEY', config.google.privateKey],
    ['GOOGLE_DRIVE_ROOT_FOLDER_ID', config.google.driveRootFolderId],
  ];

  const missing = required.filter(([, val]) => !val).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
