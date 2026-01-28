const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const uploadProgress = document.getElementById('uploadProgress');
const progressFileName = document.getElementById('progressFileName');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'];
const MAX_SIZE = 60 * 1024 * 1024;

const FILE_ICONS = {
  pdf: '📄', doc: '📝', docx: '📝',
  txt: '📃', md: '📃',
  csv: '📊', xls: '📊', xlsx: '📊',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', heic: '🖼️',
};

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

async function handleFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) { showToast(`File type .${ext} not allowed`, 'error'); continue; }
    if (file.size > MAX_SIZE) { showToast(`${file.name} is too large (max 60MB)`, 'error'); continue; }
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
    const formData = new FormData();
    formData.append('file', file);

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
          resolve(JSON.parse(xhr.responseText));
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error)); }
          catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.open('PUT', '/api/upload');
      xhr.setRequestHeader('x-filename', file.name);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    progressFill.classList.add('done');
    progressPercent.textContent = '✓';
    showToast(`${file.name} uploaded!`, 'success');
    await loadFiles();
    setTimeout(() => { uploadProgress.hidden = true; }, 2000);

    // Sync to Google Drive in background (fire & forget)
    fetch('/api/drive-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: result.url,
        pathname: result.pathname || file.name,
        contentType: file.type || 'application/octet-stream',
      }),
    }).then(r => r.json()).then(d => {
      if (d.success) console.log('📁 Synced to Google Drive:', d.driveName);
      else console.warn('Drive sync failed:', d.error);
    }).catch(e => console.warn('Drive sync error:', e));
  } catch (error) {
    progressFill.classList.add('error');
    progressPercent.textContent = 'Failed';
    showToast(`Upload failed: ${error.message}`, 'error');
    setTimeout(() => { uploadProgress.hidden = true; }, 3000);
  }
}

async function loadFiles() {
  try {
    const response = await fetch('/api/files');
    if (!response.ok) throw new Error('Failed to load files');
    const { blobs } = await response.json();

    if (!blobs || blobs.length === 0) {
      fileList.innerHTML = '<div class="empty-state">No files yet. Upload something!</div>';
      fileCount.textContent = '0 files';
      return;
    }

    fileCount.textContent = `${blobs.length} file${blobs.length !== 1 ? 's' : ''}`;
    fileList.innerHTML = blobs.map(file => {
      const name = file.pathname || file.url.split('/').pop();
      const ext = name.split('.').pop().toLowerCase();
      const icon = FILE_ICONS[ext] || '📎';
      const size = formatSize(file.size);
      const date = new Date(file.uploadedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <div class="file-item">
          <div class="file-icon">${icon}</div>
          <div class="file-info">
            <div class="file-name"><a href="${file.url}" target="_blank">${escapeHtml(name)}</a></div>
            <div class="file-meta">${size} · ${date}</div>
          </div>
          <div class="file-actions">
            <a href="${file.url}" download class="btn-icon" title="Download">⬇️</a>
            <button class="btn-icon delete" title="Delete" onclick="deleteFile('${encodeURIComponent(file.url)}', '${escapeHtml(name)}')">🗑️</button>
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
    const response = await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: decodeURIComponent(encodedUrl) }),
    });
    if (!response.ok) throw new Error('Delete failed');
    showToast(`${name} deleted`, 'success');
    await loadFiles();
  } catch (error) {
    showToast(`Failed to delete: ${error.message}`, 'error');
  }
}

function formatSize(bytes) {
  if (!bytes) return '?';
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

loadFiles();
