const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Use PUT with file body' });

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
