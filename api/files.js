const { list, del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const result = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL required' });
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
