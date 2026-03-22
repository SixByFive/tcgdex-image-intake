'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Find a folder by name under a given parent folder ID.
 * Returns the folder ID if found, or null.
 */
async function findFolder(drive, name, parentId) {
  const q = [
    `name = "${name}"`,
    `mimeType = "application/vnd.google-apps.folder"`,
    `"${parentId}" in parents`,
    `trashed = false`,
  ].join(' and ');

  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const files = res.data.files;
  return files && files.length > 0 ? files[0].id : null;
}

/**
 * Create a folder under a given parent folder ID.
 * Returns the new folder ID.
 */
async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return res.data.id;
}

/**
 * Find or create a folder by name under parentId.
 * Returns the folder ID.
 */
async function findOrCreateFolder(drive, name, parentId) {
  const existing = await findFolder(drive, name, parentId);
  if (existing) {
    logger.debug({ name, parentId }, 'Found existing Drive folder');
    return existing;
  }

  const created = await createFolder(drive, name, parentId);
  logger.info({ name, parentId, folderId: created }, 'Created Drive folder');
  return created;
}

/**
 * Upload a single file to Google Drive.
 * Returns the uploaded file ID.
 */
async function uploadFile(drive, localPath, filename, parentFolderId, mimeType) {
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(localPath),
    },
    fields: 'id',
  });

  return res.data.id;
}

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Upload a batch of renamed card image files to Google Drive.
 * Optionally uploads a set symbol to the set folder.
 *
 * @param {string} setCode
 * @param {string} submissionId
 * @param {Array<{ cardNumber, localPath, canonicalFilename, ext }>} files
 * @param {{ absPath: string, ext: string } | null} symbolFile
 * @returns {{ setFolderId, submissionFolderId, uploads, symbolFile }}
 */
async function uploadCardImages(setCode, submissionId, files, symbolFile = null) {
  const drive = getDriveClient();

  logger.info({ setCode, submissionId }, 'Drive upload started');

  // Find or create set folder under root
  const setFolderId = await findOrCreateFolder(drive, setCode, config.google.driveRootFolderId);

  // Always create a fresh submission folder
  const submissionFolderId = await createFolder(drive, submissionId, setFolderId);

  logger.info({ submissionFolderId }, 'Created submission folder');

  const uploads = [];

  for (const file of files) {
    const mimeType = EXT_MIME[file.ext] || 'application/octet-stream';

    const fileId = await uploadFile(
      drive,
      file.localPath,
      file.canonicalFilename,
      submissionFolderId,
      mimeType
    );

    logger.info({ fileId, filename: file.canonicalFilename }, 'File uploaded to Drive');

    uploads.push({
      cardNumber: file.cardNumber,
      filename: file.canonicalFilename,
      fileId,
    });
  }

  // Upload symbol to set folder if provided
  let uploadedSymbol = null;
  if (symbolFile) {
    const symbolFilename = `symbol${symbolFile.ext}`;
    const mimeType = EXT_MIME[symbolFile.ext] || 'application/octet-stream';

    const fileId = await uploadFile(
      drive,
      symbolFile.absPath,
      symbolFilename,
      setFolderId,
      mimeType
    );

    logger.info({ fileId, filename: symbolFilename }, 'Symbol uploaded to Drive set folder');

    uploadedSymbol = { filename: symbolFilename, fileId };
  }

  return { setFolderId, submissionFolderId, uploads, symbolFile: uploadedSymbol };
}

module.exports = { uploadCardImages };
