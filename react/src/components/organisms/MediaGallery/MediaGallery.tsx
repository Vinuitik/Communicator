import React, { useCallback, useEffect, useState } from 'react';
import { deleteFriendMedia, getFriendMediaPage, getPrimaryPhoto, setPrimaryPhoto } from '../../../services/api/friendService';
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
  onAddMedia: () => void;
  onPrimaryPhotoChanged: (photoName: string) => void;
  onNotify: (message: string, type?: 'success' | 'error') => void;
}

// Ported from profile's modules/{pagination,galleryManager,mediaModal,primaryPhoto,
// mediaDeletion,mediaElementFactory}.js — the "Media Gallery" section of the
// profile page: paginated photo/video/resource grid, click-to-preview modal,
// primary-photo set/check, and delete. Collapsed into one organism since
// React's re-render model replaces the manual DOM-patching those 6 modules
// existed for; see ProfilePage's header comment for the full module map.
//
// FileController.getFileUploadPage (GET /api/friend/files/{friendId}/page/{pageId})
// already existed for the never-finished legacy pagination UI — this is its
// first real caller. Same for setPrimaryPhoto/getPrimaryPhoto/deleteFiles.
//
// The modal's "Size" field always shows "Unknown": the legacy fetchMediaInfo()
// call hits FILES_BASE/info/{friendId}/{fileName}, but that route doesn't
// exist anywhere in resourceRepository's Flask app (checked blueprints/*.py —
// only /upload, /file/<>/<>, /delete are registered). Ported as-is (the real
// fetch is still made and still fails) rather than hardcoding "Unknown" —
// see communicator-legacy-bugs.md entry #2.
const MediaGallery: React.FC<MediaGalleryProps> = ({ friendId, onAddMedia, onPrimaryPhotoChanged, onNotify }) => {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [videos, setVideos] = useState<MediaVideo[]>([]);
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const [modalItem, setModalItem] = useState<ModalItem | null>(null);
  const [modalSize, setModalSize] = useState('-');
  const [isPrimary, setIsPrimary] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const openModal = async (item: ModalItem) => {
    setModalItem(item);
    setModalSize('-');
    setIsPrimary(false);

    if (item.type === 'photo') {
      try {
        const primary = await getPrimaryPhoto(friendId);
        setIsPrimary(primary.primaryPhotoId === item.id);
      } catch {
        // Non-fatal — button just won't reflect primary state.
      }
    }

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
    if (!window.confirm(`Are you sure you want to delete "${modalItem.name}"?`)) return;
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

  return (
    <div className="profile-section bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Media Gallery</h2>
        <button type="button" onClick={onAddMedia} className="px-4 py-2 text-sm bg-brand text-white rounded hover:bg-brand-dark">Add Media</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4 min-h-[100px]">
        {loading ? (
          <div className="col-span-full text-center text-gray-500 p-6">Loading media...</div>
        ) : !hasMedia ? (
          <div className="col-span-full text-center text-gray-500 p-6">No photos, videos, or resources yet. Click &quot;Add Media&quot; to get started!</div>
        ) : (
          <>
            {photos.map((photo) => (
              <div
                key={`photo-${photo.id}`}
                onClick={() => openModal({ type: 'photo', id: photo.id, name: photo.photoName })}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-100 hover:opacity-90 transition-opacity"
              >
                <img
                  src={`${API_BASE.FILES}/file/${friendId}/${photo.photoName}`}
                  alt={photo.photoName}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {videos.map((video) => (
              <div
                key={`video-${video.id}`}
                onClick={() => openModal({ type: 'video', id: video.id, name: video.videoName })}
                className="aspect-square rounded-lg bg-gray-800 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
              >
                <span className="text-white text-3xl">▶</span>
              </div>
            ))}
            {resources.map((resource) => (
              <div
                key={`resource-${resource.id}`}
                onClick={() => openModal({ type: 'resource', id: resource.id, name: resource.resourceName, mimeType: resource.mimeType })}
                className="aspect-square rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-1 p-2 cursor-pointer hover:bg-gray-50 transition-colors text-center"
              >
                <div className="text-2xl">{resourceIcon(resource.mimeType)}</div>
                <div className="text-xs text-gray-700 truncate w-full" title={resource.resourceName}>{resource.resourceName}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {totalItems > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => loadPage(currentPage - 1)}
              className="w-8 h-8 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >‹</button>
            {pageNumbers ? (
              pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => loadPage(n)}
                  className={`w-8 h-8 rounded border text-sm ${n === currentPage ? 'bg-brand text-white border-brand' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  {n}
                </button>
              ))
            ) : (
              <span className="text-sm text-gray-600 px-2">Page {currentPage} of {totalPages}</span>
            )}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => loadPage(currentPage + 1)}
              className="w-8 h-8 rounded border border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >›</button>
          </div>
          <div className="text-xs text-gray-500">Page {currentPage} of {totalPages} • {totalItems} items</div>
        </div>
      )}

      {modalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center overflow-y-auto py-8" onClick={closeModal}>
          <div className="bg-white rounded-xl w-[90%] max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-800 m-0 truncate">{modalItem.name}</h3>
              <button type="button" onClick={closeModal} className="text-2xl text-gray-500 hover:text-gray-900 leading-none">&times;</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {modalItem.type === 'photo' && (
                <div className="mb-4">
                  <button
                    type="button"
                    disabled={isPrimary || settingPrimary}
                    onClick={handleSetPrimary}
                    className={`px-4 py-2 rounded text-sm font-medium ${isPrimary ? 'bg-amber-100 text-amber-800 cursor-not-allowed' : 'bg-brand text-white hover:bg-brand-dark'} disabled:opacity-70`}
                  >
                    {settingPrimary ? '⏳ Setting...' : isPrimary ? '⭐ Primary Photo' : '⭐ Set as Primary'}
                  </button>
                </div>
              )}

              <div className="mb-5 min-h-[200px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                {modalItem.type === 'photo' && (
                  <img src={fileUrl} alt={modalItem.name} className="max-w-full max-h-96 rounded-lg" />
                )}
                {modalItem.type === 'video' && (
                  <video controls className="max-w-full max-h-96 rounded-lg">
                    <source src={fileUrl} type="video/mp4" />
                  </video>
                )}
                {modalItem.type === 'resource' && modalItem.mimeType?.includes('pdf') && (
                  <iframe title={modalItem.name} src={fileUrl} className="w-full h-96 border-0 rounded-lg" />
                )}
                {modalItem.type === 'resource' && modalItem.mimeType?.includes('image') && (
                  <img src={fileUrl} alt={modalItem.name} className="max-w-full max-h-96 rounded-lg" />
                )}
                {modalItem.type === 'resource' && !modalItem.mimeType?.includes('pdf') && !modalItem.mimeType?.includes('image') && (
                  <div className="p-10 text-center">
                    <div className="text-5xl mb-4">{resourceIcon(modalItem.mimeType)}</div>
                    <h4 className="text-gray-800">{modalItem.name}</h4>
                    <p className="text-gray-500 mb-3">Preview not available for this file type</p>
                    <a href={fileUrl} target="_blank" rel="noreferrer" className="px-4 py-2 rounded bg-gray-500 text-white text-sm hover:bg-gray-700">Open in New Tab</a>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm flex flex-col gap-2">
                <p><strong className="inline-block min-w-[80px] text-gray-800">File:</strong> {modalItem.name}</p>
                <p><strong className="inline-block min-w-[80px] text-gray-800">Type:</strong> {modalItem.type === 'resource' ? (modalItem.mimeType || 'Unknown') : modalItem.type}</p>
                <p><strong className="inline-block min-w-[80px] text-gray-800">Size:</strong> {modalSize}</p>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end p-5 border-t border-gray-200 bg-gray-50">
              <button type="button" disabled={deleting} onClick={handleDelete} className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60">
                {deleting ? '⏳ Deleting...' : '🗑️ Delete'}
              </button>
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded bg-gray-500 text-white text-sm hover:bg-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
