'use strict';

const { config } = require('../config/env');
const { unauthorized } = require('../utils/responses');
const logger = require('../utils/logger');

function authMiddleware(req, res, next) {
  const provided = req.headers['x-api-key'];

  if (!provided || provided !== config.apiKey) {
    logger.warn({ ip: req.ip }, 'Auth failure: invalid or missing API key');
    return unauthorized(res);
  }

  next();
}

module.exports = authMiddleware;
