import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../../molecules/ConfirmDialog';
import { deleteFriendMedia, getFriendMediaPage, getPrimaryPhoto, setPrimaryPhoto, uploadFriendFiles } from '../../../services/api/friendService';
import { MediaPhoto, MediaResource, MediaType, MediaVideo } from '../../../types/api';
import { API_BASE } from '../../../services/api/config';

interface ModalItem {
  type: MediaType;
  id: number;
  name: string;
  mimeType?: string;
}

const resourceIcon = (mimeType?: string): string => {
  if (!mimeType) return '📁';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('text')) return '📋';
  if (mimeType.includes('audio')) return '🎵';
  if (mimeType.includes('video')) return '🎥';
  if (mimeType.includes('archive') || mimeType.includes('zip')) return '📦';
  return '📁';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

interface MediaGalleryProps {
  friendId: number;
  onPrimaryPhotoChanged: (photoName: string) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

// Ported from profile's modules/{pagination,galleryManager,mediaModal,primaryPhoto,
// mediaDeletion,mediaElementFactory}.js — the "Media Gallery" section of the
// profile page: paginated photo/video/resource grid, click-to-preview modal,
// primary-photo set/check, and delete. Collapsed into one organism since
// React's re-render model replaces the manual DOM-patching those 6 modules
// existed for.
//
// "+ Add media" used to navigate to the standalone /fileUpload page
// (FileUploadPage, now retired — its drag-drop UI is more than this tab
// needs); it's a plain hidden-input upload here instead, calling the same
// uploadFriendFiles the old page used.
//
// The modal's "Size" field always shows "Unknown": the legacy fetchMediaInfo()
// call hits FILES_BASE/info/{friendId}/{fileName}, but that route doesn't
// exist anywhere in resourceRepository's Flask app (checked blueprints/*.py —
// only /upload, /file/<>/<>, /delete are registered). Ported as-is (the real
// fetch is still made and still fails) rather than hardcoding "Unknown" —
// see communicator-legacy-bugs.md entry #2.
const MediaGallery: React.FC<MediaGalleryProps> = ({ friendId, onPrimaryPhotoChanged, onNotify }) => {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [primaryPhotoId, setPrimaryPhotoId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalSize, setModalSize] = useState('-');
  const [isPrimary, setIsPrimary] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadPage = useCallback(async (pageNumber: number): Promise<void> => {
    setLoading(true);
    try {
      const data = await getFriendMediaPage(friendId, pageNumber);
      const isEmptyPastFirst = data.photos.length + data.videos.length + data.resources.length === 0 && pageNumber > 1;
      if (isEmptyPastFirst) {
        return loadPage(pageNumber - 1);
      }
      setPhotos(data.photos);
      setVideos(data.videos);
      setResources(data.resources);
      setCurrentPage(data.currentPage);
      setTotalPages(Math.max(1, data.totalPages));
      setTotalItems(data.totalItems);
    } catch {
      onNotify('Failed to load page. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  useEffect(() => { loadPage(1); }, [loadPage]);
  useEffect(() => {
    getPrimaryPhoto(friendId).then((r) => setPrimaryPhotoId(r.primaryPhotoId)).catch(() => {});
  }, [friendId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await uploadFriendFiles(friendId, Array.from(files));
      onNotify(`${files.length} file${files.length > 1 ? 's' : ''} uploaded.`);
      await loadPage(1);
    } catch {
      onNotify('Failed to upload media. Please try again.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openModal = async (item: ModalItem) => {
    setModalItem(item);
    setModalSize('-');
    setIsPrimary(item.type === 'photo' && primaryPhotoId === item.id);

    try {
      const response = await fetch(`${API_BASE.FILES}/info/${friendId}/${item.name}`);
      if (response.ok) {
        const info = await response.json();
        if (info.size) setModalSize(formatFileSize(info.size));
      } else {
        setModalSize('Unknown');
      }
    } catch {
      setModalSize('Unknown');
    }
  };

  const closeModal = () => setModalItem(null);

  useEffect(() => {
    if (!modalItem) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalItem]);

  const handleSetPrimary = async () => {
    if (!modalItem || modalItem.type !== 'photo') return;
    setSettingPrimary(true);
    try {
      await setPrimaryPhoto(friendId, modalItem.id);
      setIsPrimary(true);
      setPrimaryPhotoId(modalItem.id);
      onPrimaryPhotoChanged(modalItem.name);
      onNotify(`"${modalItem.name}" is now the primary photo!`);
    } catch {
      onNotify('Failed to set primary photo. Please try again.', 'error');
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleDelete = async () => {
    if (!modalItem) return;
    setConfirmDelete(false);
    setDeleting(true);
    try {
      await deleteFriendMedia(friendId, modalItem.type, modalItem.id);
      onNotify(`"${modalItem.name}" has been deleted successfully.`);
      closeModal();
      await loadPage(currentPage);
    } catch {
      onNotify('Failed to delete media. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const fileUrl = modalItem ? `${API_BASE.FILES}/file/${friendId}/${modalItem.name}` : '';
  const hasMedia = photos.length > 0 || videos.length > 0 || resources.length > 0;

  const pageNumbers = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : null;

  const addMediaButton = (
    <button
      type="button"
      disabled={uploading}
      onClick={() => fileInputRef.current?.click()}
      className="border-none bg-accent-gradient text-white font-bold text-[12.5px] px-3.5 py-2 rounded-input shadow-button-sm hover:brightness-110 disabled:opacity-50 transition-all"
    >
      {uploading ? 'Uploading…' : '+ Add media'}
    </button>
  );

  return (
    <div className="bg-surface border border-hairline rounded-card p-5">
      <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-text-primary">Media gallery</h2>
        {hasMedia && addMediaButton}
      </div>

      {loading ? (
        <div className="text-center text-text-muted p-8">Loading media…</div>
      ) : !hasMedia ? (
        <div className="text-center py-12 px-4 border border-dashed border-white/[.12] rounded-card">
          <div className="text-[34px] opacity-50 mb-2.5">🖼️</div>
          <div className="text-sm text-text-muted font-semibold">No photos or files yet</div>
          <div className="text-xs text-text-faint mt-1 mb-4">Drop in photos, videos or documents to remember moments.</div>
          {addMediaButton}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {photos.map((photo) => (
              <div
                key={`photo-${photo.id}`}
                onClick={() => openModal({ type: 'photo', id: photo.id, name: photo.photoName })}
                className="relative aspect-square rounded-card overflow-hidden cursor-pointer border border-white/[.06] hover:opacity-90 transition-opacity"
              >
                <img
                  src={`${API_BASE.FILES}/file/${friendId}/${photo.photoName}`}
                  alt={photo.photoName}
                  className="w-full h-full object-cover"
                />
                {primaryPhotoId === photo.id && <span className="absolute top-1.5 right-2 text-soon text-[13px]">★</span>}
              </div>
            ))}
            {videos.map((video) => (
              <div
                key={`video-${video.id}`}
                onClick={() => openModal({ type: 'video', id: video.id, name: video.videoName })}
                className="aspect-square rounded-card bg-input border border-white/[.06] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
              >
                <span className="text-text-primary text-3xl">▶</span>
              </div>
            ))}
            {resources.map((resource) => (
              <div
                key={`resource-${resource.id}`}
                onClick={() => openModal({ type: 'resource', id: resource.id, name: resource.resourceName, mimeType: resource.mimeType })}
                className="aspect-square rounded-card border border-white/[.06] bg-input flex flex-col items-center justify-center gap-1 p-2 cursor-pointer hover:bg-input-2 transition-colors text-center"
              >
                <div className="text-2xl">{resourceIcon(resource.mimeType)}</div>
                <div className="text-xs text-text-muted truncate w-full" title={resource.resourceName}>{resource.resourceName}</div>
              </div>
            ))}
          </div>

          {totalItems > 0 && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => loadPage(currentPage - 1)}
                  className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent/40"
                >‹</button>
                {pageNumbers ? (
                  pageNumbers.map((n) => (
                    <button
                      key={n}
                      onClick={() => loadPage(n)}
                      className={`w-8 h-8 rounded-lg border text-sm ${n === currentPage ? 'bg-accent/20 text-text-emphasis border-accent/40 font-bold' : 'border-white/10 bg-input text-text-secondary hover:border-accent/40'}`}
                    >
                      {n}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-text-muted px-2">Page {currentPage} of {totalPages}</span>
                )}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => loadPage(currentPage + 1)}
                  className="w-8 h-8 rounded-lg border border-white/10 bg-input text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent/40"
                >›</button>
              </div>
              <div className="text-xs text-text-faint">Page {currentPage} of {totalPages} · {totalItems} items</div>
            </div>
          )}
        </>
      )}

      {modalItem && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-start justify-center overflow-y-auto py-8 animate-ftfade" onClick={closeModal}>
          <div className="bg-modal border border-white/10 rounded-card w-[90%] max-w-2xl overflow-hidden shadow-modal animate-ftmodal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hairline">
              <h3 className="text-base font-display font-bold text-text-primary m-0 truncate">{modalItem.name}</h3>
              <button type="button" onClick={closeModal} className="text-xl text-text-muted hover:text-text-emphasis leading-none">&times;</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {modalItem.type === 'photo' && (
                <div className="mb-4">
                  <button
                    type="button"
                    disabled={isPrimary || settingPrimary}
                    onClick={handleSetPrimary}
                    className={`px-4 py-2 rounded-input text-sm font-bold ${isPrimary ? 'bg-soon/15 text-soon cursor-not-allowed' : 'bg-accent-gradient text-white shadow-button-sm hover:brightness-110'} disabled:opacity-70 transition-all`}
                  >
                    {settingPrimary ? '⏳ Setting…' : isPrimary ? '★ Primary photo' : '★ Set as primary'}
                  </button>
                </div>
              )}

              <div className="mb-5 min-h-[200px] flex items-center justify-center border border-dashed border-white/10 rounded-card bg-surface-2">
                {modalItem.type === 'photo' && (
                  <img src={fileUrl} alt={modalItem.name} className="max-w-full max-h-96 rounded-card" />
                )}
                {modalItem.type === 'video' && (
                  <video controls className="max-w-full max-h-96 rounded-card">
                    <source src={fileUrl} type="video/mp4" />
                  </video>
                )}
                {modalItem.type === 'resource' && modalItem.mimeType?.includes('pdf') && (
                  <iframe title={modalItem.name} src={fileUrl} className="w-full h-96 border-0 rounded-card" />
                )}
                {modalItem.type === 'resource' && modalItem.mimeType?.includes('image') && (
                  <img src={fileUrl} alt={modalItem.name} className="max-w-full max-h-96 rounded-card" />
                )}
                {modalItem.type === 'resource' && !modalItem.mimeType?.includes('pdf') && !modalItem.mimeType?.includes('image') && (
                  <div className="p-10 text-center">
                    <div className="text-5xl mb-4">{resourceIcon(modalItem.mimeType)}</div>
                    <h4 className="text-text-primary">{modalItem.name}</h4>
                    <p className="text-text-muted mb-3">Preview not available for this file type</p>
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-input bg-input text-text-emphasis text-sm hover:bg-input-2 transition-colors">Open in new tab</a>
                  </div>
                )}
              </div>

              <div className="bg-surface-2 border border-white/[.06] rounded-card p-4 text-sm flex flex-col gap-2 text-text-secondary">
                <p><strong className="inline-block min-w-[80px] text-text-primary">File:</strong> {modalItem.name}</p>
                <p><strong className="inline-block min-w-[80px] text-text-primary">Type:</strong> {modalItem.type === 'resource' ? (modalItem.mimeType || 'Unknown') : modalItem.type}</p>
                <p><strong className="inline-block min-w-[80px] text-text-primary">Size:</strong> {modalSize}</p>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end p-5 border-t border-hairline">
              <button type="button" disabled={deleting} onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-input bg-bad/15 border border-bad/40 text-bad text-sm font-semibold hover:bg-bad/25 disabled:opacity-60 transition-colors">
                {deleting ? '⏳ Deleting…' : '🗑️ Delete'}
              </button>
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-input border border-white/10 text-text-emphasis text-sm font-semibold hover:bg-white/5 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${modalItem?.name}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default MediaGallery;
