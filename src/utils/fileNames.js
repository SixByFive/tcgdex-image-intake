'use strict';

const path = require('path');
const { padCardNumber } = require('./cardNumbers');

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const JUNK_FILES = new Set(['.ds_store', 'thumbs.db']);
const SYMBOL_BASENAMES = new Set(['symbol', 'logo']);

const SET_CODE_RE = /^[A-Z0-9][A-Z0-9.\-]{1,9}$/;

function isJunkFile(filename) {
  const base = path.basename(filename).toLowerCase();
  return JUNK_FILES.has(base) || base.startsWith('__macosx');
}

function isValidSetCode(name) {
  return SET_CODE_RE.test(name.toUpperCase());
}

function parseZipFilename(filename) {
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

  if (SYMBOL_BASENAMES.has(base)) {
    return { isSymbol: true, ext };
  }

  const numMatch = base.match(/(\d+)/);
  if (numMatch) {
    return { cardNumber: padCardNumber(numMatch[1]), ext, isSymbol: false };
  }

  return {
    error: `Invalid image filename "${filename}". Filename must contain a card number (e.g. 001.png, Blitzle-12.png). Use "symbol.png" or "logo.png" for the set logo.`,
  };
}

/**
 * Validate and parse a filename one level deep inside a set folder.
 * entryName format: SETCODE/filename.ext
 * Returns { setCode, parsedFile } or { error }
 */
function parseNestedZipEntry(entryName) {
  const normalised = entryName.replace(/\\/g, '/');
  const parts = normalised.split('/');

  if (parts.length !== 2) {
    return { error: `Only one level of folder nesting is allowed: "${entryName}"` };
  }

  const [folder, filename] = parts;
  const setCode = folder.toUpperCase();

  if (!isValidSetCode(setCode)) {
    return { error: `Folder name "${folder}" is not a valid set code` };
  }

  const parsed = parseZipFilename(filename);
  if (parsed.error) return { error: parsed.error };

  return { setCode, parsedFile: parsed };
}

function buildCanonicalFilename(setCode, cardNumber, ext) {
  return `${setCode}-${cardNumber}${ext}`;
}

module.exports = {
  isJunkFile,
  isValidSetCode,
  parseZipFilename,
  parseNestedZipEntry,
  buildCanonicalFilename,
  ALLOWED_EXTENSIONS,
  SYMBOL_BASENAMES,
};