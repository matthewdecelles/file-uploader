import { handleUpload } from '@vercel/blob/client';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const jsonResponse = await handleUpload({
      body: request,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate file type
        const ext = pathname.split('.').pop().toLowerCase();
        const allowed = ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'];
        if (!allowed.includes(ext)) {
          throw new Error(`File type .${ext} not allowed`);
        }
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
          maximumSizeInBytes: 60 * 1024 * 1024, // 60MB
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Upload completed:', blob.url);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
}
