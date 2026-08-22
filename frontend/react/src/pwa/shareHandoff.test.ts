import { buildPendingShare } from './shareHandoff';

// buildPendingShare is the one piece of the share-target hand-off that's pure
// (no IndexedDB), so it's the one piece unit-testable in this stack — jsdom
// has no real IndexedDB implementation and the repo has no fake-indexeddb
// dependency for the existing db.ts/outbox.ts either. The IndexedDB round trip
// (putPendingShare in service-worker.js → takePendingShare here) is covered by
// the manual test procedure in src/pwa/FLOWS.md instead.

function makeFile(name: string, type: string, content = 'x'): File {
  return new File([content], name, { type });
}

describe('buildPendingShare', () => {
  it('extracts a single shared file plus title/text', () => {
    const form = new FormData();
    form.append('media', makeFile('photo.jpg', 'image/jpeg'));
    form.append('title', 'Beach day');
    form.append('text', 'from the trip');

    const result = buildPendingShare(form, 'share-1', 1000);

    expect(result).toEqual({
      id: 'share-1',
      files: [{ name: 'photo.jpg', type: 'image/jpeg', blob: expect.any(File) }],
      title: 'Beach day',
      text: 'from the trip',
      ts: 1000,
    });
  });

  it('extracts multiple shared files', () => {
    const form = new FormData();
    form.append('media', makeFile('a.jpg', 'image/jpeg'));
    form.append('media', makeFile('b.mp4', 'video/mp4'));

    const result = buildPendingShare(form, 'share-2', 2000);

    expect(result?.files.map((f) => f.name)).toEqual(['a.jpg', 'b.mp4']);
  });

  it('returns null when no files were shared', () => {
    const form = new FormData();
    form.append('title', 'no files here');

    expect(buildPendingShare(form, 'share-3')).toBeNull();
  });

  it('ignores a zero-byte file entry', () => {
    const form = new FormData();
    form.append('media', makeFile('empty.jpg', 'image/jpeg', ''));

    expect(buildPendingShare(form, 'share-4')).toBeNull();
  });

  it('defaults title/text to empty strings when absent', () => {
    const form = new FormData();
    form.append('media', makeFile('c.png', 'image/png'));

    const result = buildPendingShare(form, 'share-5', 3000);

    expect(result?.title).toBe('');
    expect(result?.text).toBe('');
  });
});
