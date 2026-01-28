import { list } from '@vercel/blob';

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { blobs } = await list();
    const files = blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      downloadUrl: blob.downloadUrl,
    }));

    // Sort newest first
    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return response.status(200).json({ files });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
