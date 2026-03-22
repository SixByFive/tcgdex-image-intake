'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { parseCardNumbers } = require('../utils/cardNumbers');
const { buildCanonicalFilename } = require('../utils/filenames');
const { extractAndMap } = require('./zip.service');
const { uploadCardImages } = require('./drive.service');
const { zipPath, extractDir, cleanupSubmission } = require('../utils/tempDirs');
const logger = require('../utils/logger');

/**
 * Build a submission ID like: SV2A-2026-03-21T15-12-44Z-a1b2c3
 */
function buildSubmissionId(setCode) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = uuidv4().split('-')[0];
  return `${setCode}-${timestamp}-${suffix}`;
}

/**
 * Process a card image upload submission.
 *
 * @param {object} rawInput - { setCode, cardNumbers, multerFile }
 * @returns {{ success, data?, error? }}
 */
async function processUpload(rawInput) {
  const { multerFile } = rawInput;

  // --- 1. Normalize setCode ---
  const setCode = (rawInput.setCode || '').trim().toUpperCase();
  if (!setCode) {
    return { success: false, error: 'setCode is required', status: 400 };
  }

  // --- 2. Normalize cardNumbers ---
  const { numbers: requestedNumbers, error: numbersError } = parseCardNumbers(rawInput.cardNumbers);
  if (numbersError) {
    return { success: false, error: numbersError, status: 400 };
  }

  // --- 3. Generate submission ID and move zip to canonical temp location ---
  const submissionId = buildSubmissionId(setCode);
  const destZipPath = zipPath(submissionId);

  try {
    fs.renameSync(multerFile.path, destZipPath);
  } catch (err) {
    logger.error({ err }, 'Failed to move uploaded zip to temp location');
    return { success: false, error: 'Internal server error', status: 500 };
  }

  const destExtractDir = extractDir(submissionId);

  try {
    // --- 4. Extract zip and build image map ---
    logger.info({ submissionId, setCode }, 'Zip extraction started');

    const { imageMap, symbolFile, error: extractError } = extractAndMap(destZipPath, destExtractDir);

    if (extractError) {
      return { success: false, error: extractError, status: 400 };
    }

    // --- 5. Cross-check requested numbers vs extracted files ---
    const extractedNumbers = new Set(Object.keys(imageMap));
    const requestedSet = new Set(requestedNumbers);

    const missing = requestedNumbers.filter((n) => !extractedNumbers.has(n));
    const extra = [...extractedNumbers].filter((n) => !requestedSet.has(n));

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

    // --- 6. Build canonical file list ---
    const filesToUpload = requestedNumbers.map((cardNumber) => {
      const { absPath, ext } = imageMap[cardNumber];
      return {
        cardNumber,
        localPath: absPath,
        canonicalFilename: buildCanonicalFilename(setCode, cardNumber, ext),
        ext,
      };
    });

    // --- 7. Upload to Google Drive ---
    logger.info({ submissionId, count: filesToUpload.length, hasSymbol: !!symbolFile }, 'Drive upload started');

    const { setFolderId, submissionFolderId, uploads, symbolFile: uploadedSymbol } = await uploadCardImages(
      setCode,
      submissionId,
      filesToUpload,
      symbolFile
    );

    logger.info({ submissionId }, 'Upload completed successfully');

    return {
      success: true,
      data: {
        setCode,
        submissionId,
        requestedCardNumbers: requestedNumbers,
        matchedCount: uploads.length,
        uploadedFiles: uploads,
        ...(uploadedSymbol && { symbolFile: uploadedSymbol }),
        drive: {
          setFolderId,
          submissionFolderId,
        },
      },
    };
  } finally {
    // --- 8. Always clean up temp files ---
    cleanupSubmission(submissionId);
  }
}

module.exports = { processUpload };