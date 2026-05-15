'use strict';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function getS3Client() {
  return new S3Client({
    endpoint: config.s3.endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
    },
    forcePathStyle: true,
  });
}

const EXT_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Upload a single file to S3.
 * Returns the object key (path within the bucket).
 */
async function uploadFile(client, localPath, objectKey, mimeType) {
  const fileStream = fs.createReadStream(localPath);
  const fileSize = fs.statSync(localPath).size;

  const command = new PutObjectCommand({
    Bucket: config.s3.bucketName,
    Key: objectKey,
    Body: fileStream,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  await client.send(command);

  logger.info({ objectKey }, 'File uploaded to S3');

  return objectKey;
}

async function uploadCardImages(lang, serie, setCode, submissionId, files, symbolFile = null) {
  const client = getS3Client();

  const setPrefix = `${lang}/${serie}/${setCode}`;
  const submissionPrefix = `${setPrefix}/${submissionId}`;

  logger.info({ lang, serie, setCode, submissionId, bucket: config.s3.bucketName }, 'S3 upload started');

  const uploads = [];

  for (const file of files) {
    const mimeType = EXT_MIME[file.ext] || 'application/octet-stream';
    const objectKey = `${submissionPrefix}/${file.canonicalFilename}`;

    await uploadFile(client, file.localPath, objectKey, mimeType);

    uploads.push({
      cardNumber: file.cardNumber,
      filename: file.canonicalFilename,
      objectKey,
    });
  }

  let uploadedSymbol = null;
  if (symbolFile) {
    const symbolFilename = `symbol${symbolFile.ext}`;
    const mimeType = EXT_MIME[symbolFile.ext] || 'application/octet-stream';
    const objectKey = `${submissionPrefix}/${symbolFilename}`;

    await uploadFile(client, symbolFile.absPath, objectKey, mimeType);

    logger.info({ objectKey }, 'Symbol uploaded to S3');

    uploadedSymbol = { filename: symbolFilename, objectKey };
  }

  logger.info({ submissionId }, 'S3 upload completed');

  return { bucketName: config.s3.bucketName, setPrefix, submissionPrefix, uploads, symbolFile: uploadedSymbol };
}

module.exports = { uploadCardImages };
