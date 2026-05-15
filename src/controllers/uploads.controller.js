'use strict';

const { processUpload } = require('../services/upload.service');
const { ok, badRequest, internalError } = require('../utils/responses');
const logger = require('../utils/logger');

async function uploadCardImagesController(req, res) {
  logger.info({ ip: req.ip, body: req.body }, 'Card image upload request received');

  if (!req.file) {
    return badRequest(res, 'zipFile is required');
  }

  const lang = (req.body.lang || '').trim();
  const serie = (req.body.serie || '').trim();

  if (!lang) return badRequest(res, 'lang is required');
  if (!serie) return badRequest(res, 'serie is required');

  // setCode is optional — if omitted the zip must use folder-per-set structure
  // cardNumbers is optional — if omitted card numbers are auto-resolved from filenames

  try {
    const result = await processUpload({
      lang,
      serie,
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