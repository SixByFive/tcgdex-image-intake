'use strict';

/**
 * Parse and normalise a raw cardNumbers string from the request.
 * - Split on commas
 * - Trim whitespace
 * - Drop empty segments
 * - Assert each segment is purely numeric
 * - Zero-pad to 3 digits
 * - Detect duplicates
 *
 * Returns { numbers: string[], error: string|null }
 */
function parseCardNumbers(raw) {
  if (!raw || typeof raw !== 'string') {
    return { numbers: null, error: 'cardNumbers is required' };
  }

  const segments = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) {
    return { numbers: null, error: 'cardNumbers must contain at least one value' };
  }

  const normalised = [];

  for (const seg of segments) {
    if (!/^\d+[A-Za-z]?$/.test(seg)) {
      return {
        numbers: null,
        error: `Invalid card number "${seg}". Card numbers must be numeric only.`,
      };
    }
    normalised.push(padCardNumber(seg));
  }

  // Detect duplicates
  const seen = new Set();
  for (const n of normalised) {
    if (seen.has(n)) {
      return {
        numbers: null,
        error: `Duplicate card number "${n}" in request.`,
      };
    }
    seen.add(n);
  }

  return { numbers: normalised, error: null };
}

/**
 * Zero-pad a numeric string to 3 digits.
 * e.g. "1" -> "001", "10" -> "010", "100" -> "100"
 */
function padCardNumber(n) {
  return n.padStart(3, '0');
}

module.exports = { parseCardNumbers, padCardNumber };
