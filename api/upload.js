const { put } = require('@vercel/blob');
const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST = client upload token generation (for large files)
  if (req.method === 'POST') {
    try {
      const jsonResponse = await handleUpload({
        body: req,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          return {
            allowedContentTypes: [
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
              'text/markdown',
              'text/csv',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'image/png',
              'image/jpeg',
              'image/gif',
              'image/webp',
              'image/svg+xml',
              'image/heic',
            ],
            maximumSizeInBytes: 60 * 1024 * 1024,
            tokenPayload: JSON.stringify({}),
          };
        },
        onUploadCompleted: async ({ blob }) => {
          console.log('Client upload completed:', blob.url);
        },
      });
      return res.status(200).json(jsonResponse);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // PUT = direct server upload (for small files < 4.5MB)
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Use PUT or POST' });

  const filename = req.headers['x-filename'] || 'upload';
  const contentType = req.headers['content-type'] || 'application/octet-stream';

  try {
    const blob = await put(filename, req, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
