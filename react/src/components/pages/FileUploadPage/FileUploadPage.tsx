import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { uploadFriendFiles } from '../../../services/api/friendService';

type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'default';

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  category: FileCategory;
  lastModified: Date;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FILE_ICONS: Record<FileCategory, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📕',
  default: '📄',
};

const getFileCategory = (mimeType: string): FileCategory => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'default';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const truncateFileName = (fileName: string, maxLength = 30): string => {
  if (fileName.length <= maxLength) return fileName;
  const extension = fileName.split('.').pop() || '';
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
  const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
  return `${truncatedName}.${extension}`;
};

// Ported from nginx/static/fileUpload/{fileUpload.html,fileUpload.js} +
// JS_Classes/* (FileValidator, FileCollection, DragDropHandler,
// FileListRenderer, FileUtilities, PreviewManager, ProgressTracker,
// UIStateManager, UploadController) — collapsed into one component's state
// since React's re-render model replaces the manual listener/render wiring
// those classes existed for.
//
// Reached at /friends/:id/fileUpload (fileUploadPath) — legacy parsed
// friendId off the last URL segment (/fileUpload/{friendId}) since it had no
// router; this uses a real :id param instead, same repointing SocialPage did.
// Not linked from anywhere in the SPA yet (ProfilePage, the only legacy page
// that links here — profile.js / mediaUpload.js — isn't ported), same
// "built ahead of its entry point" situation as SocialPage before it.
//
// FileController.uploadFiles (POST /api/friend/files/upload) already existed
// and matches the legacy multipart body exactly — no backend changes needed.
//
// The progress bar is ported as decorative, matching real legacy behavior:
// ProgressTracker.update() is only ever called with 0, both before and after
// the fetch — nothing in the original code ever computed a real percentage.
const FileUploadPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const friendId = Number(id);

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewFile) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewFile(null); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewFile]);

  useEffect(() => {
    if (!previewFile) {
      setPreviewUrl(null);
      return;
    }
    if (!['image', 'video', 'audio', 'pdf'].includes(previewFile.category)) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => {
      let next = prev;
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          window.alert(`Maximum ${MAX_FILES} files allowed`);
          break;
        }
        if (file.size > MAX_FILE_SIZE) {
          window.alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
          continue;
        }
        if (next.some((f) => f.name === file.name && f.size === file.size)) {
          window.alert(`File "${file.name}" is already selected.`);
          continue;
        }
        next = [...next, {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          category: getFileCategory(file.type),
          lastModified: new Date(file.lastModified),
        }];
      }
      return next;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setPreviewFile((prev) => (prev?.id === fileId ? null : prev));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setPreviewFile(null);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const dropped = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await uploadFriendFiles(friendId, files.map((f) => f.file));
      window.alert('Files uploaded successfully!');
      clearAllFiles();
    } catch (err) {
      window.alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const uploadLabel = files.length === 0 ? 'Upload Files' : `Upload ${files.length} File${files.length === 1 ? '' : 's'}`;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <h1 className="text-2xl font-medium text-gray-800 mb-6">Add Files</h1>

      <div className="bg-white rounded-lg shadow p-8 mb-6">
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg text-center py-12 px-8 mb-8 cursor-pointer transition-all
            ${isDragOver ? 'border-brand-dark bg-indigo-50 -translate-y-0.5' : 'border-brand bg-indigo-50/40 hover:bg-indigo-50 hover:-translate-y-0.5'}`}
        >
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-gray-800 font-medium mb-2">Drag & Drop Files Here</h3>
          <p className="text-gray-500 my-2">or</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="bg-brand text-white px-6 py-3 rounded font-medium my-4 hover:bg-brand-dark transition-colors"
          >
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx"
            hidden
            onChange={handleFileSelect}
          />
          <p className="text-sm text-sky-500 mt-4">Supported: Images (JPG, PNG, GIF), Videos (MP4, MOV, AVI), Documents (PDF, DOC)</p>
        </div>

        <div className="mb-8">
          <h3 className="text-gray-800 font-medium mb-3">Selected Files ({files.length})</h3>
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded bg-gray-50 p-2">
            {files.length === 0 ? (
              <div className="text-center text-gray-500 italic py-8">No files selected yet</div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => setPreviewFile(f)}
                    title="Click to preview"
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 hover:border-brand cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                      <div className="text-xl">{FILE_ICONS[f.category]}</div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate" title={f.name}>{truncateFileName(f.name)}</div>
                        <div className="text-sm text-gray-500">{formatFileSize(f.size)}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Remove file"
                      onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                      className="w-6 h-6 flex-shrink-0 rounded-full bg-red-600 text-white text-sm leading-none hover:bg-red-700 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <button
            type="button"
            disabled={files.length === 0 || uploading}
            onClick={handleUpload}
            className="min-w-[140px] px-6 py-3 rounded bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {uploadLabel}
          </button>
          <button
            type="button"
            onClick={clearAllFiles}
            className="min-w-[140px] px-6 py-3 rounded bg-gray-500 text-white font-medium hover:bg-gray-700 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {uploading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: '0%' }} />
          </div>
          <span className="font-medium text-gray-800">0%</span>
        </div>
      )}

      {previewFile && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-8"
          onClick={() => setPreviewFile(null)}
        >
          <div className="bg-white rounded-xl w-[90%] max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-800 m-0">{previewFile.name}</h3>
              <button type="button" onClick={() => setPreviewFile(null)} className="text-2xl text-gray-500 hover:text-gray-900 leading-none">&times;</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <div className="mb-5 min-h-[200px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                {previewFile.category === 'image' && previewUrl && (
                  <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-96 rounded-lg" />
                )}
                {previewFile.category === 'video' && previewUrl && (
                  <video controls className="max-w-full max-h-96 rounded-lg">
                    <source src={previewUrl} type={previewFile.type} />
                  </video>
                )}
                {previewFile.category === 'audio' && previewUrl && (
                  <div className="p-10 text-center">
                    <div className="text-5xl mb-4">🎵</div>
                    <h4 className="text-gray-800 mb-4">{previewFile.name}</h4>
                    <audio controls className="w-full">
                      <source src={previewUrl} type={previewFile.type} />
                    </audio>
                  </div>
                )}
                {previewFile.category === 'pdf' && previewUrl && previewFile.type === 'application/pdf' && (
                  <iframe title={previewFile.name} src={previewUrl} className="w-full h-96 border-0 rounded-lg" />
                )}
                {previewFile.category === 'default' && (
                  <div className="p-10 text-center">
                    <div className="text-5xl mb-4 text-gray-500">📄</div>
                    <h4 className="text-gray-800">{previewFile.name}</h4>
                    <p className="text-gray-500">Preview not available for this file type</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm flex flex-col gap-2">
                <p><strong className="inline-block min-w-[120px] text-gray-800">Name:</strong> {previewFile.name}</p>
                <p><strong className="inline-block min-w-[120px] text-gray-800">Size:</strong> {formatFileSize(previewFile.size)}</p>
                <p><strong className="inline-block min-w-[120px] text-gray-800">Type:</strong> {previewFile.type || 'Unknown'}</p>
                <p><strong className="inline-block min-w-[120px] text-gray-800">Last Modified:</strong> {previewFile.lastModified.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end p-5 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => removeFile(previewFile.id)}
                className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
              >
                🗑️ Remove File
              </button>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 rounded bg-gray-500 text-white text-sm hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadPage;
