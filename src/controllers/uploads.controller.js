'use strict';

const { processUpload } = require('../services/upload.service');
const { ok, badRequest, internalError } = require('../utils/responses');
const logger = require('../utils/logger');

async function uploadCardImagesController(req, res) {
  logger.info({ ip: req.ip, body: req.body }, 'Card image upload request received');

  if (!req.file) {
    return badRequest(res, 'zipFile is required');
  }

  if (!req.body.setCode) {
    return badRequest(res, 'setCode is required');
  }

  if (!req.body.cardNumbers) {
    return badRequest(res, 'cardNumbers is required');
  }

  try {
    const result = await processUpload({
      setCode: req.body.setCode,
      cardNumbers: req.body.cardNumbers,
      multerFile: req.file,
    });

    if (!result.success) {
      const status = result.status || 400;
      logger.warn({ error: result.error }, 'Upload validation failed');
      return res.status(status).json({ success: false, error: result.error });
    }

    return ok(res, result.data);
  } catch (err) {
    logger.error({ err }, 'Unexpected error during upload');
    return internalError(res);
  }
}

module.exports = { uploadCardImagesController };
