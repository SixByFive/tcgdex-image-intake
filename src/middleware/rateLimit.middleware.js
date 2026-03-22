'use strict';

const rateLimit = require('express-rate-limit');
const { tooManyRequests } = require('../utils/responses');

const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => tooManyRequests(res),
});

module.exports = { uploadRateLimit };
