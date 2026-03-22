'use strict';

const multer = require('multer');
const path = require('path');
const { config } = require('../config/env');
const { badRequest } = require('../utils/responses');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.tempUploadDir);
  },
  filename: (req, file, cb) => {
    // Temp name — will be renamed by the controller once the submission ID is known
    const safeName = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
    cb(null, safeName);
  },
});

function zipFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.zip') {
    return cb(
      Object.assign(new Error('Only .zip files are accepted'), { statusCode: 400 }),
      false
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: zipFilter,
});

/**
 * Wraps multer.single so that multer errors are returned as clean JSON
 * rather than the default Express error HTML.
 */
function uploadMiddleware(req, res, next) {
  const single = upload.single('zipFile');

  single(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return badRequest(
          res,
          `File exceeds the maximum allowed size of ${config.maxUploadMb} MB`
        );
      }
      return badRequest(res, `Upload error: ${err.message}`);
    }

    if (err && err.statusCode === 400) {
      return badRequest(res, err.message);
    }

    next(err);
  });
}

module.exports = uploadMiddleware;
