'use strict';

const rateLimit = require('express-rate-limit');
const { tooManyRequests } = require('../utils/responses');

const uploadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => tooManyRequests(res),
});

module.exports = { uploadRateLimit };
