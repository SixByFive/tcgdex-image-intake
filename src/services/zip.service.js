'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { isJunkFile, parseZipFilename, parseNestedZipEntry } = require('../utils/fileNames');
const logger = require('../utils/logger');

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
    if (entry.isDirectory) continue;
    if (entryName.startsWith('__MACOSX/') || entryName.startsWith('__MACOSX\\')) continue;

    const basename = path.basename(entryName);
    if (isJunkFile(basename)) continue;

    const parsed = parseZipFilename(entryName);
    if (parsed.error) {
      errors.push(parsed.error);
      continue;
    }

    const destPath = path.join(destDir, basename);
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

  if (Object.keys(imageMap).length === 0 && !symbolFile) {
    return { imageMap: null, symbolFile: null, error: 'No valid image files found in zip.' };
  }

  logger.info({ count: Object.keys(imageMap).length, hasSymbol: !!symbolFile }, 'Zip extraction completed');

  return { imageMap, symbolFile, error: null };
}

/**
 * Extract a multi-set zip where files live inside per-set folders.
 * Returns { sets, error } where:
 *   sets: {
 *     [setCode]: {
 *       imageMap: { [cardNumber]: { absPath, ext } },
 *       symbolFile: { absPath, ext } | null
 *     }
 *   }
 */
function extractAndMapMulti(zipFilePath, destDir) {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (err) {
    logger.warn({ err }, 'Failed to open zip');
    return { sets: null, error: 'Could not open zip file. It may be corrupted or invalid.' };
  }

  fs.mkdirSync(destDir, { recursive: true });

  const entries = zip.getEntries();
  const sets = {};
  const errors = [];

  for (const entry of entries) {
    const entryName = entry.entryName;
    if (entry.isDirectory) continue;
    if (entryName.startsWith('__MACOSX/') || entryName.startsWith('__MACOSX\\')) continue;

    const basename = path.basename(entryName);
    if (isJunkFile(basename)) continue;

    const { setCode, parsedFile, error } = parseNestedZipEntry(entryName);
    if (error) {
      errors.push(error);
      continue;
    }

    const setDestDir = path.join(destDir, setCode);
    fs.mkdirSync(setDestDir, { recursive: true });

    const destPath = path.join(setDestDir, basename);
    const resolved = path.resolve(destPath);
    const resolvedDest = path.resolve(setDestDir);
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

    if (!sets[setCode]) {
      sets[setCode] = { imageMap: {}, symbolFile: null };
    }

    if (parsedFile.isSymbol) {
      if (sets[setCode].symbolFile) {
        errors.push(`Duplicate symbol file found for set "${setCode}". Only one symbol file is allowed per set.`);
        continue;
      }
      sets[setCode].symbolFile = { absPath: destPath, ext: parsedFile.ext };
      logger.debug({ setCode, destPath }, 'Symbol file extracted');
      continue;
    }

    const { cardNumber, ext } = parsedFile;
    if (sets[setCode].imageMap[cardNumber]) {
      errors.push(`Duplicate image file for card number "${cardNumber}" in set "${setCode}"`);
      continue;
    }

    sets[setCode].imageMap[cardNumber] = { absPath: destPath, ext, originalName: basename };
  }

  if (errors.length > 0) {
    return { sets: null, error: errors[0] };
  }

  if (Object.keys(sets).length === 0) {
    return { sets: null, error: 'No valid set folders found in zip.' };
  }

  logger.info({ sets: Object.keys(sets) }, 'Multi-set zip extraction completed');

  return { sets, error: null };
}

module.exports = { extractAndMap, extractAndMapMulti };