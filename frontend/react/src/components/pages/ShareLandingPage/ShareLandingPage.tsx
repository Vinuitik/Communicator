import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FriendPicker from '../../molecules/FriendPicker';
import { useToast } from '../../molecules/Toast';
import { takePendingShare, PendingShareFile } from '../../../pwa/shareHandoff';
import * as blobOutbox from '../../../pwa/blobOutbox';
import { ROUTES } from '../../../utils/constants';

type Status = 'loading' | 'ready' | 'expired' | 'sharing' | 'done';

// Landing page the service worker's share-target handler redirects to
// (/app/share?shared=1&shareId=<id>) after the OS share sheet hands a
// photo/video into the app. Reads the file out of the SW's one-time
// IndexedDB hand-off (shareHandoff.ts), lets the user pick which friend it
// belongs to, then queues it for upload via blobOutbox — the same binary
// queue used for any offline share, so this works identically online and
// offline. See pwa/FLOWS.md's "Flow — share_target" section.
const ShareLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const shareId = searchParams.get('shareId');

  const [status, setStatus] = useState<Status>('loading');
  const [files, setFiles] = useState<PendingShareFile[]>([]);
  const [friendId, setFriendId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!shareId) {
      setStatus('expired');
      return;
    }
    (async () => {
      const share = await takePendingShare(shareId);
      if (cancelled) return;
      if (!share || share.files.length === 0) {
        setStatus('expired');
        return;
      }
      setFiles(share.files);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [shareId]);

  // Revoke object URLs on unmount/file change so previews don't leak memory.
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f.blob)), [files]);
  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);

  const handleShare = async () => {
    if (friendId === null || files.length === 0) return;
    setStatus('sharing');
    try {
      for (const file of files) {
        await blobOutbox.enqueue(file.blob, { friendId, requestId: crypto.randomUUID() });
      }
      // Best-effort immediate attempt — offline or a failure just leaves it
      // queued for wireAutoFlush's next trigger (online/visibility/60s), same
      // as every other offline write in this app.
      void blobOutbox.flush();
      setStatus('done');
      showToast(
        files.length > 1 ? `${files.length} files shared` : 'Shared — uploading now (or once you\'re back online)',
      );
      navigate(ROUTES.HOME);
    } catch (err) {
      setStatus('ready');
      showToast(err instanceof Error ? err.message : 'Could not queue the share.', 'error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="animate-ftfade max-w-[480px] mx-auto px-[30px] py-10 text-center text-text-muted text-sm">
        Loading shared file…
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="animate-ftfade max-w-[480px] mx-auto px-[30px] py-10 text-center">
        <p className="text-text-secondary text-sm mb-4">
          This share link has expired or was already used.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.HOME)}
          className="text-accent text-sm underline"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="animate-ftfade max-w-[480px] mx-auto px-[30px] py-6">
      <h1 className="text-lg font-semibold text-text-primary mb-4">Share to a friend</h1>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {files.map((file, i) => (
          <div key={i} className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-surface-2 border border-white/10">
            {file.type.startsWith('video/') ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={previewUrls[i]} className="w-full h-full object-cover" muted />
            ) : (
              <img src={previewUrls[i]} alt={file.name} className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>

      <label className="block text-xs text-text-muted mb-1.5">Who is this for?</label>
      <FriendPicker
        variant="list"
        searchable
        value={friendId}
        onChange={setFriendId}
        disabled={status === 'sharing'}
      />

      <button
        type="button"
        onClick={handleShare}
        disabled={friendId === null || status === 'sharing'}
        className="w-full mt-5 py-2.5 rounded-input bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === 'sharing' ? 'Sharing…' : 'Share'}
      </button>
    </div>
  );
};

export default ShareLandingPage;
