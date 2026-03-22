'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { isJunkFile, parseZipFilename } = require('../utils/filenames');
const logger = require('../utils/logger');

/**
 * Safely extract the zip at zipFilePath into destDir.
 * Returns { imageMap, symbolFile, error } where:
 *   imageMap:   { [cardNumber: string]: { absPath: string, ext: string } }
 *   symbolFile: { absPath: string, ext: string } | null
 *
 * Rejects:
 *  - Nested file paths
 *  - Invalid / non-numeric filenames (symbol.ext is allowed)
 *  - Disallowed file types
 *  - Duplicate card numbers within the zip
 */
function extractAndMap(zipFilePath, destDir) {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (err) {
    logger.warn({ err }, 'Failed to open zip');
    return { imageMap: null, symbolFile: null, error: 'Could not open zip file. It may be corrupted or invalid.' };
  }

  fs.mkdirSync(destDir, { recursive: true });

  const entries = zip.getEntries();
  const imageMap = {};
  let symbolFile = null;
  const errors = [];

  for (const entry of entries) {
    const entryName = entry.entryName;

    // Skip directories
    if (entry.isDirectory) continue;

    // Skip __MACOSX junk entries
    if (entryName.startsWith('__MACOSX/') || entryName.startsWith('__MACOSX\\')) continue;

    const basename = path.basename(entryName);

    // Skip known junk files
    if (isJunkFile(basename)) continue;

    // Validate filename — also checks for nested paths
    const parsed = parseZipFilename(entryName);

    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    // Extract safely
    const destPath = path.join(destDir, basename);

    // Double-check resolved path stays inside destDir (directory traversal guard)
    const resolved = path.resolve(destPath);
    const resolvedDest = path.resolve(destDir);
    if (!resolved.startsWith(resolvedDest + path.sep)) {
      errors.push(`Rejected file with suspicious path: "${entryName}"`);
      continue;
    }

    try {
      fs.writeFileSync(destPath, entry.getData());
    } catch (writeErr) {
      errors.push(`Failed to extract "${basename}": ${writeErr.message}`);
      continue;
    }

    // Route to symbol or image map
    if (parsed.isSymbol) {
      if (symbolFile) {
        errors.push('Duplicate symbol file found in zip. Only one symbol file is allowed.');
        continue;
      }
      symbolFile = { absPath: destPath, ext: parsed.ext };
      logger.debug({ destPath }, 'Symbol file extracted');
      continue;
    }

    const { cardNumber, ext } = parsed;

    // Detect duplicate card numbers within the zip
    if (imageMap[cardNumber]) {
      errors.push(
        `Duplicate image file for card number "${cardNumber}" in zip (found both "${imageMap[cardNumber].originalName}" and "${basename}")`
      );
      continue;
    }

    imageMap[cardNumber] = { absPath: destPath, ext, originalName: basename };
  }

  if (errors.length > 0) {
    return { imageMap: null, symbolFile: null, error: errors[0] };
  }

  if (Object.keys(imageMap).length === 0) {
    return { imageMap: null, symbolFile: null, error: 'No valid image files found in zip.' };
  }

  logger.info({ count: Object.keys(imageMap).length, hasSymbol: !!symbolFile }, 'Zip extraction completed');

  return { imageMap, symbolFile, error: null };
}

module.exports = { extractAndMap };
