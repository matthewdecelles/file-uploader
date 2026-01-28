import { del } from '@vercel/blob';

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'DELETE') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const blobUrl = request.query.url;
    if (!blobUrl) {
      return response.status(400).json({ error: 'URL parameter required' });
    }

    await del(blobUrl);
    return response.status(200).json({ success: true });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}
