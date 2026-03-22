'use strict';

const logger = require('../utils/logger');
const { internalError } = require('../utils/responses');

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  logger.error({ err }, 'Unhandled error');
  return internalError(res);
}

module.exports = errorMiddleware;
