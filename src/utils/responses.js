'use strict';

function ok(res, data) {
  return res.status(200).json({ success: true, ...data });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, error: message });
}

function unauthorized(res) {
  return res.status(401).json({ success: false, error: 'Unauthorized' });
}

function tooManyRequests(res) {
  return res.status(429).json({ success: false, error: 'Too many requests' });
}

function internalError(res, message = 'Internal server error') {
  return res.status(500).json({ success: false, error: message });
}

module.exports = { ok, badRequest, unauthorized, tooManyRequests, internalError };
