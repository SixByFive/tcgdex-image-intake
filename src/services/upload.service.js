'use strict';

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parseCardNumbers } = require('../utils/cardNumbers');
const { buildCanonicalFilename } = require('../utils/fileNames');
const { extractAndMap, extractAndMapMulti } = require('./zip.service');
const { uploadCardImages } = require('./storage.service');
const { zipPath, extractDir, cleanupSubmission } = require('../utils/tempDirs');
const logger = require('../utils/logger');

function buildSubmissionId(setCode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = uuidv4().split('-')[0];
  return `${setCode}-${timestamp}-${suffix}`;
}

async function processSingleSetUpload(setCode, cardNumbers, destZipPath, destExtractDir) {
  const { imageMap, symbolFile, error: extractError } = extractAndMap(destZipPath, destExtractDir);

  if (extractError) {
    return { success: false, error: extractError, status: 400 };
  }

  const hasCardNumbers = cardNumbers && cardNumbers.trim().length > 0;
  let requestedNumbers = [];

  if (hasCardNumbers) {
    const { numbers, error: numbersError } = parseCardNumbers(cardNumbers);
    if (numbersError) {
      return { success: false, error: numbersError, status: 400 };
    }
    requestedNumbers = numbers;

    const extractedNumbers = new Set(Object.keys(imageMap));
    const missing = requestedNumbers.filter((n) => !extractedNumbers.has(n));
    const extra = [...extractedNumbers].filter((n) => !new Set(requestedNumbers).has(n));

    if (missing.length > 0) {
      return {
        success: false,
        error: `Missing image files for card numbers: ${missing.join(', ')}`,
        status: 400,
      };
    }

    if (extra.length > 0) {
      return {
        success: false,
        error: `Unexpected image files found in zip: ${extra.join(', ')}`,
        status: 400,
      };
    }
  } else {
    requestedNumbers = Object.keys(imageMap).sort();
  }

  const filesToUpload = requestedNumbers.map((cardNumber) => {
    const { absPath, ext } = imageMap[cardNumber];
    return {
      cardNumber,
      localPath: absPath,
      canonicalFilename: buildCanonicalFilename(setCode, cardNumber, ext),
      ext,
    };
  });

  const submissionId = buildSubmissionId(setCode);

  const { bucketName, setPrefix, submissionPrefix, uploads, symbolFile: uploadedSymbol } =
    await uploadCardImages(setCode, submissionId, filesToUpload, symbolFile);

  return {
    success: true,
    data: {
      setCode,
      submissionId,
      ...(requestedNumbers.length > 0 && { requestedCardNumbers: requestedNumbers }),
      ...(uploads.length > 0 && { matchedCount: uploads.length, uploadedFiles: uploads }),
      ...(uploadedSymbol && { symbolFile: uploadedSymbol }),
      storage: { bucketName, setPrefix, submissionPrefix },
    },
  };
}

async function processMultiSetUpload(destZipPath, destExtractDir) {
  const { sets, error: extractError } = extractAndMapMulti(destZipPath, destExtractDir);

  if (extractError) {
    return { success: false, error: extractError, status: 400 };
  }

  const results = [];

  for (const [setCode, { imageMap, symbolFile }] of Object.entries(sets)) {
    const submissionId = buildSubmissionId(setCode);
    const cardNumbers = Object.keys(imageMap).sort();

    const filesToUpload = cardNumbers.map((cardNumber) => {
      const { absPath, ext } = imageMap[cardNumber];
      return {
        cardNumber,
        localPath: absPath,
        canonicalFilename: buildCanonicalFilename(setCode, cardNumber, ext),
        ext,
      };
    });

    const { bucketName, setPrefix, submissionPrefix, uploads, symbolFile: uploadedSymbol } =
      await uploadCardImages(setCode, submissionId, filesToUpload, symbolFile);

    results.push({
      setCode,
      submissionId,
      ...(uploads.length > 0 && { matchedCount: uploads.length, uploadedFiles: uploads }),
      ...(uploadedSymbol && { symbolFile: uploadedSymbol }),
      storage: { bucketName, setPrefix, submissionPrefix },
    });

    logger.info({ setCode, submissionId }, 'Set uploaded successfully');
  }

  return {
    success: true,
    data: {
      multiSet: true,
      setCount: results.length,
      sets: results,
    },
  };
}

/**
 * Main entry point.
 * Routes to single or multi-set processing based on whether setCode is provided.
 *
 * @param {object} rawInput - { setCode?, cardNumbers?, multerFile }
 * @returns {{ success, data?, error? }}
 */
async function processUpload(rawInput) {
  const { multerFile } = rawInput;
  const setCode = (rawInput.setCode || '').trim().toLowerCase();
  const isMultiSet = !setCode;

  const submissionId = isMultiSet ? buildSubmissionId('MULTI') : buildSubmissionId(setCode);
  const destZipPath = zipPath(submissionId);
  const destExtractDir = extractDir(submissionId);

  try {
    fs.renameSync(multerFile.path, destZipPath);
  } catch (err) {
    logger.error({ err }, 'Failed to move uploaded zip to temp location');
    return { success: false, error: 'Internal server error', status: 500 };
  }

  try {
    logger.info({ submissionId, isMultiSet, setCode: setCode || null }, 'Upload processing started');

    if (isMultiSet) {
      return await processMultiSetUpload(destZipPath, destExtractDir);
    } else {
      return await processSingleSetUpload(setCode, rawInput.cardNumbers, destZipPath, destExtractDir);
    }
  } finally {
    cleanupSubmission(submissionId);
  }
}

module.exports = { processUpload };