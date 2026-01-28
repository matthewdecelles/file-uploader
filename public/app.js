const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const emptyState = document.getElementById('emptyState');
const uploadProgress = document.getElementById('uploadProgress');
const progressFileName = document.getElementById('progressFileName');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'];
const MAX_SIZE = 60 * 1024 * 1024; // 60MB

const FILE_ICONS = {
  pdf: '📄',
  doc: '📝', docx: '📝',
  txt: '📃', md: '📃',
  csv: '📊', xls: '📊', xlsx: '📊',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', heic: '🖼️',
};

// Drag & drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

async function handleFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showToast(`File type .${ext} not allowed`, 'error');
      continue;
    }
    if (file.size > MAX_SIZE) {
      showToast(`${file.name} is too large (max 60MB)`, 'error');
      continue;
    }
    await uploadFile(file);
  }
}

async function uploadFile(file) {
  uploadProgress.hidden = false;
  progressFileName.textContent = file.name;
  progressPercent.textContent = '0%';
  progressFill.style.width = '0%';
  progressFill.classList.remove('done', 'error');

  try {
    // Step 1: Get the upload token from our API
    const tokenResponse = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: {
          pathname: file.name,
          callbackUrl: `${window.location.origin}/api/upload`,
        },
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json();
      throw new Error(err.error || 'Failed to get upload token');
    }

    const { type, clientToken } = await tokenResponse.json();

    // Step 2: Upload directly to Vercel Blob using the client token
    // Parse the client token to get the upload URL
    const tokenParts = clientToken.split('.');
    const tokenPayload = JSON.parse(atob(tokenParts[1]));
    const uploadUrl = tokenPayload.url || `https://blob.vercel-storage.com`;

    // Use XMLHttpRequest for progress tracking
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressPercent.textContent = `${pct}%`;
          progressFill.style.width = `${pct}%`;
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({});
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));

      // Upload to Vercel Blob API directly
      xhr.open('PUT', `https://blob.vercel-storage.com/${file.name}`);
      xhr.setRequestHeader('Authorization', `Bearer ${clientToken}`);
      xhr.setRequestHeader('x-content-type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-api-version', '7');
      xhr.send(file);
    });

    progressFill.classList.add('done');
    progressPercent.textContent = '✓';
    showToast(`${file.name} uploaded!`, 'success');

    // Refresh file list
    await loadFiles();

    // Hide progress after a delay
    setTimeout(() => {
      uploadProgress.hidden = true;
    }, 2000);

  } catch (error) {
    progressFill.classList.add('error');
    progressPercent.textContent = 'Failed';
    showToast(`Upload failed: ${error.message}`, 'error');
    setTimeout(() => {
      uploadProgress.hidden = true;
    }, 3000);
  }
}

async function loadFiles() {
  try {
    const response = await fetch('/api/files');
    if (!response.ok) throw new Error('Failed to load files');
    const { files } = await response.json();

    if (files.length === 0) {
      fileList.innerHTML = '<div class="empty-state">No files yet. Upload something!</div>';
      fileCount.textContent = '0 files';
      return;
    }

    fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    fileList.innerHTML = files.map(file => {
      const ext = file.pathname.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || '📎';
      const size = formatSize(file.size);
      const date = new Date(file.uploadedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <div class="file-item">
          <div class="file-icon">${icon}</div>
          <div class="file-info">
            <div class="file-name"><a href="${file.url}" target="_blank">${escapeHtml(file.pathname)}</a></div>
            <div class="file-meta">${size} · ${date}</div>
          </div>
          <div class="file-actions">
            <a href="${file.downloadUrl || file.url}" download class="btn-icon" title="Download">⬇️</a>
            <button class="btn-icon delete" title="Delete" onclick="deleteFile('${encodeURIComponent(file.url)}', '${escapeHtml(file.pathname)}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load files:', error);
  }
}

async function deleteFile(encodedUrl, name) {
  if (!confirm(`Delete "${name}"?`)) return;

  try {
    const response = await fetch(`/api/files/${encodedUrl}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
    showToast(`${name} deleted`, 'success');
    await loadFiles();
  } catch (error) {
    showToast(`Failed to delete: ${error.message}`, 'error');
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Load files on page load
loadFiles();
