'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../config/env');
const logger = require('./logger');

/**
 * Ensure both temp directories exist on disk.
 * Called once at startup.
 */
function ensureTempDirs() {
  for (const dir of [config.tempUploadDir, config.tempExtractDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Return the path where the uploaded zip should be stored.
 */
function zipPath(submissionId) {
  return path.join(config.tempUploadDir, `${submissionId}.zip`);
}

/**
 * Return the directory where the zip should be extracted.
 */
function extractDir(submissionId) {
  return path.join(config.tempExtractDir, submissionId);
}

/**
 * Delete a file if it exists. Logs but does not throw.
 */
function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    logger.warn({ err, filePath }, 'Failed to delete temp file');
  }
}

/**
 * Recursively delete a directory. Logs but does not throw.
 */
function safeRmDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn({ err, dirPath }, 'Failed to delete temp directory');
  }
}

/**
 * Clean up all temp artifacts for a submission.
 */
function cleanupSubmission(submissionId) {
  safeUnlink(zipPath(submissionId));
  safeRmDir(extractDir(submissionId));
  logger.info({ submissionId }, 'Temp cleanup completed');
}

module.exports = { ensureTempDirs, zipPath, extractDir, cleanupSubmission };
