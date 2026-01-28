/**
 * POST /api/drive-sync
 * Called after a file is uploaded to Vercel Blob.
 * Downloads the blob and uploads it to Google Drive.
 * 
 * Body: { url, pathname, contentType }
 */

const DRIVE_FOLDER_ID = '1uoyhBdJrSeVMJsx6YXi2Tc1EV0l0nL_7';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token error: ${data.error_description || data.error}`);
  return data.access_token;
}

async function uploadToDrive(accessToken, fileBuffer, filename, contentType) {
  const metadata = {
    name: filename,
    parents: [DRIVE_FOLDER_ID],
  };

  // Use multipart upload
  const boundary = 'drive_upload_boundary_' + Date.now();
  const metadataStr = JSON.stringify(metadata);
  
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  const data = await res.json();
  if (data.error) throw new Error(`Drive upload error: ${data.error.message}`);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Check required env vars
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('Missing Google Drive credentials');
    return res.status(500).json({ error: 'Google Drive not configured' });
  }

  try {
    // Parse body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const { url, pathname, contentType } = body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const filename = pathname || url.split('/').pop() || 'upload';

    // Download from Vercel Blob
    const blobRes = await fetch(url);
    if (!blobRes.ok) throw new Error(`Failed to fetch blob: ${blobRes.status}`);
    const fileBuffer = Buffer.from(await blobRes.arrayBuffer());

    // Upload to Google Drive
    const accessToken = await getAccessToken();
    const driveFile = await uploadToDrive(
      accessToken,
      fileBuffer,
      filename,
      contentType || 'application/octet-stream'
    );

    console.log(`✅ Uploaded to Drive: ${driveFile.name} (${driveFile.id})`);
    return res.status(200).json({
      success: true,
      driveId: driveFile.id,
      driveName: driveFile.name,
    });
  } catch (error) {
    console.error('Drive sync error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
