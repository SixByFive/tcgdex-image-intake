'use strict';

const path = require('path');
const { padCardNumber } = require('./cardNumbers');

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const JUNK_FILES = new Set(['.ds_store', 'thumbs.db']);

// Reserved filenames for set symbol/logo
const SYMBOL_BASENAMES = new Set(['symbol', 'logo']);

/**
 * Returns true if a filename inside the zip should be silently ignored.
 */
function isJunkFile(filename) {
  const base = path.basename(filename).toLowerCase();
  return JUNK_FILES.has(base) || base.startsWith('__macosx');
}

/**
 * Validate and parse a raw filename from the zip.
 * Returns one of:
 *   { cardNumber: string, ext: string, isSymbol: false }
 *   { isSymbol: true, ext: string }
 *   { error: string }
 *
 * Rules:
 *  - Must be a root-level file (no path separators)
 *  - Extension must be in ALLOWED_EXTENSIONS
 *  - Basename must be "symbol" or "logo" (set symbol/logo), OR
 *  - Basename must contain at least one number — that number is extracted as the card number
 *    e.g. 001.png, Blitzle-12-XY-Trainer-Kit.png, Potion-21-XY-Trainer-Kit.png
 */
function parseZipFilename(filename) {
  // Reject nested paths
  const normalised = filename.replace(/\\/g, '/');
  if (normalised.includes('/')) {
    return { error: `Nested file path not allowed: "${filename}"` };
  }

  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, path.extname(filename)).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      error: `Unsupported file type "${ext}" in "${filename}". Allowed types: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    };
  }

  // Reserved: set symbol/logo
  if (SYMBOL_BASENAMES.has(base)) {
    return { isSymbol: true, ext };
  }

  // Extract the first number found in the basename
  const numMatch = base.match(/(\d+)/);
  if (numMatch) {
    return { cardNumber: padCardNumber(numMatch[1]), ext, isSymbol: false };
  }

  return {
    error: `Invalid image filename "${filename}". Filename must contain a card number (e.g. 001.png, Blitzle-12.png). Use "symbol.png" or "logo.png" for the set logo.`,
  };
}

/**
 * Build the canonical output filename.
 * e.g. setCode=SV2A, cardNumber=001, ext=.png -> "SV2A-001.png"
 */
function buildCanonicalFilename(setCode, cardNumber, ext) {
  return `${setCode}-${cardNumber}${ext}`;
}

module.exports = { isJunkFile, parseZipFilename, buildCanonicalFilename, ALLOWED_EXTENSIONS, SYMBOL_BASENAMES };