#!/usr/bin/env node
/**
 * Polls Vercel Blob for new uploads, downloads them locally,
 * and saves metadata for Stanley to process into context.
 * 
 * Run via cron or heartbeat.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const AUTH_TOKEN = 'matt2026stanley';
const UPLOAD_DIR = '/Users/stanley/clawd/uploads';
const STATE_FILE = path.join(UPLOAD_DIR, '.processed.json');
const INBOX_FILE = path.join(UPLOAD_DIR, 'inbox.json');

async function listBlobs() {
  const res = await fetch('https://file-uploader-psi-two.vercel.app/api/files', {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to list files: ${res.status}`);
  const data = await res.json();
  return data.blobs || [];
}

function getProcessed() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveProcessed(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  return buffer.length;
}

async function main() {
  const blobs = await listBlobs();
  const processed = getProcessed();
  const newFiles = [];

  for (const blob of blobs) {
    const key = blob.url;
    if (processed[key]) continue;

    const filename = blob.pathname || blob.url.split('/').pop();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destPath = path.join(UPLOAD_DIR, safeName);

    try {
      const size = await downloadFile(blob.url, destPath);
      processed[key] = {
        filename,
        localPath: destPath,
        downloadedAt: new Date().toISOString(),
        size,
        contentType: blob.contentType,
        uploadedAt: blob.uploadedAt,
      };
      newFiles.push({
        filename,
        localPath: destPath,
        contentType: blob.contentType,
        size,
        uploadedAt: blob.uploadedAt,
      });
      console.log(`✅ Downloaded: ${filename} (${size} bytes)`);
    } catch (err) {
      console.error(`❌ Failed to download ${filename}:`, err.message);
    }
  }

  saveProcessed(processed);

  if (newFiles.length > 0) {
    // Write to inbox for Stanley to pick up during heartbeat
    const inbox = [];
    try {
      const existing = JSON.parse(fs.readFileSync(INBOX_FILE, 'utf8'));
      inbox.push(...existing);
    } catch {}
    inbox.push(...newFiles);
    fs.writeFileSync(INBOX_FILE, JSON.stringify(inbox, null, 2));
    console.log(`\n📬 ${newFiles.length} new file(s) ready for processing`);
  } else {
    console.log('No new files.');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
