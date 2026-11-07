import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import { useProfiles } from '../../hooks/useProfiles';
import { useReplies } from '../../hooks/useReplies';
import { deleteMediaObject, kindOf, mimeOf, prepareFile, signMediaKeys, uploadMedia, MAX_UPLOAD_BYTES } from '../../lib/media';
import type { MediaKind } from '../../lib/media';
import { formatLongDate, toDateInput } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { MediaViewer } from '../../components/MediaViewer';
import type { ViewerItem } from '../../components/MediaViewer';
import { ReplyThread } from '../../components/ReplyThread';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { KebabMenu } from '../../components/ui/KebabMenu';
import styles from './Memories.module.css';
import shared from '../../styles/shared.module.css';

interface Memory {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  memory_date: string;
  image_path: string | null;   // storage key (column name kept from V1)
  media_type: MediaKind | null;
  storage: 'supabase' | 'r2';
  updated_at: string;
  mediaUrl?: string;
}

export const Memories = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const { nameFor } = useProfiles();
  const replies = useReplies({ table: 'memory_replies', parentColumn: 'memory_id' });

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);

  // form (add + edit share one form)
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formTop = useRef<HTMLFormElement>(null);

  const [deleting, setDeleting] = useState<Memory | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!relationshipId) return;
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('memory_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error || !data) { setLoaded(true); return; }

    const rows = data as Memory[];
    const r2Keys = rows.filter((m) => m.image_path && m.storage === 'r2').map((m) => m.image_path as string);
    const signed = await signMediaKeys(r2Keys);

    const withUrls = await Promise.all(
      rows.map(async (m) => {
        if (!m.image_path) return m;
        if (m.storage === 'r2') return { ...m, mediaUrl: signed[m.image_path] };
        // Legacy photos uploaded in V1 still live in Supabase Storage
        const { data: u } = await supabase.storage.from('relationship_media').createSignedUrl(m.image_path, 3600);
        return { ...m, mediaUrl: u?.signedUrl };
      }),
    );
    setMemories(withUrls);
    setLoaded(true);
  }, [relationshipId]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const resetForm = () => {
    setFormOpen(false); setEditing(null); setTitle(''); setDescription(''); setMemoryDate('');
    setFile(null); setRemoveMedia(false); setFormError(null); setProgress(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const openAdd = () => {
    resetForm();
    setMemoryDate(toDateInput(new Date()));
    setFormOpen(true);
  };

  const openEdit = (m: Memory) => {
    resetForm();
    setEditing(m);
    setTitle(m.title);
    setDescription(m.description ?? '');
    setMemoryDate(m.memory_date.slice(0, 10));
    setFormOpen(true);
    setTimeout(() => formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const onPickFile = (f: File | null) => {
    setFormError(null);
    if (f) {
      if (!kindOf(mimeOf(f))) { setFormError('Please choose a photo or a video.'); return; }
      if (f.size > MAX_UPLOAD_BYTES * 3) { setFormError('That file is too large.'); return; }
    }
    setFile(f);
    if (f) setRemoveMedia(false);
  };

  const removeStoredFile = async (m: Memory) => {
    if (!m.image_path) return;
    if (m.storage === 'r2') await deleteMediaObject(m.image_path);
    else await supabase.storage.from('relationship_media').remove([m.image_path]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setSaving(true);
    setFormError(null);
    setProgress(null);

    let uploadedKey: string | null = null;
    try {
      let patch: Partial<Memory> = {};

      if (file) {
        const { blob, mime } = await prepareFile(file);
        const kind = kindOf(mime);
        if (!kind) throw new Error('Unsupported file type.');
        setProgress(0);
        const up = await uploadMedia(blob, mime, relationshipId, setProgress);
        uploadedKey = up.key;
        patch = { image_path: up.key, media_type: kind, storage: 'r2', media_mime: mime } as Partial<Memory>;
      } else if (editing && removeMedia) {
        patch = { image_path: null, media_type: null, media_mime: null } as Partial<Memory>;
      }

      if (editing) {
        const { error } = await supabase
          .from('memories')
          .update({ title: title.trim(), description: description.trim() || null, memory_date: memoryDate, ...patch })
          .eq('id', editing.id);
        if (error) throw error;
        if (file || removeMedia) await removeStoredFile(editing); // old file is no longer referenced
      } else {
        const { error } = await supabase.from('memories').insert([
          {
            relationship_id: relationshipId,
            created_by: user.id,
            title: title.trim(),
            description: description.trim() || null,
            memory_date: memoryDate,
            storage: 'r2',
            ...patch,
          },
        ]);
        if (error) throw error;
      }

      resetForm();
      await fetchMemories();
    } catch (err) {
      if (uploadedKey) await deleteMediaObject(uploadedKey); // don't leave an orphan in R2
      setFormError(friendlyError(err, 'Could not save this memory.'));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from('memories').delete().eq('id', deleting.id);
    if (error) { setFormError(friendlyError(error)); setDeleting(null); return; }
    await removeStoredFile(deleting);
    setDeleting(null);
    fetchMemories();
  };

  // everything that has a viewable file, in timeline order, so the viewer can swipe through them all
  const viewerItems: ViewerItem[] = useMemo(
    () =>
      memories
        .filter((m) => m.mediaUrl && m.media_type)
        .map((m) => ({ id: m.id, url: m.mediaUrl!, kind: m.media_type!, title: m.title, caption: m.description })),
    [memories],
  );
  const openViewer = (id: string) => {
    const i = viewerItems.findIndex((v) => v.id === id);
    if (i >= 0) setViewerIndex(i);
  };

  const currentLabel = editing?.media_type === 'video' ? '🎬 Current video' : '🖼️ Current photo';

  return (
    <div className={shared.container}>
      <header className={shared.header}>
        <h1 className={shared.title}>Our Memories</h1>
        {!formOpen && <button className={shared.btn} onClick={openAdd}>+ Add Memory</button>}
      </header>

      {formOpen && (
        <form ref={formTop} onSubmit={handleSave} className={shared.formCard}>
          <h2 className={shared.formTitle}>{editing ? 'Edit memory' : 'New memory'}</h2>

          <div className={shared.inputGroup}>
            <label>Title</label>
            <input className={shared.input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Our First Trip to Cape Town" required />
          </div>
          <div className={shared.inputGroup}>
            <label>Date</label>
            <input type="date" className={shared.input} value={memoryDate} onChange={(e) => setMemoryDate(e.target.value)} required />
          </div>

          <div className={shared.inputGroup}>
            <label>{editing?.image_path ? 'Replace photo / video (optional)' : 'Photo or video (optional)'}</label>
            {editing?.image_path && !removeMedia && !file && (
              <div className={styles.currentMedia}>
                <span>{currentLabel}</span>
                <button type="button" className={shared.btnText} style={{ color: 'var(--color-danger)' }} onClick={() => setRemoveMedia(true)}>Remove</button>
              </div>
            )}
            {editing?.image_path && removeMedia && !file && (
              <div className={styles.currentMedia}>
                <span>Will be removed when you save</span>
                <button type="button" className={shared.btnText} onClick={() => setRemoveMedia(false)}>Undo</button>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              className={shared.fileInput}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {file && <span className={shared.muted}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>}
          </div>

          <div className={shared.inputGroup}>
            <label>The Story</label>
            <textarea className={shared.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Write something special about this day..." />
          </div>

          {progress !== null && (
            <div>
              <div className={styles.progress}><div className={styles.progressBar} style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <span className={shared.muted}>Uploading… {Math.round(progress * 100)}%</span>
            </div>
          )}
          {formError && <div className={shared.error}>{formError}</div>}

          <div className={shared.formActions}>
            <button type="button" className={`${shared.btn} ${shared.btnGhost}`} onClick={resetForm} disabled={saving}>Cancel</button>
            <button type="submit" className={shared.btn} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Save Memory'}</button>
          </div>
        </form>
      )}

      {!formOpen && formError && <div className={shared.error}>{formError}</div>}

      <div className={styles.timeline}>
        {loaded && memories.length === 0 && !formOpen && (
          <div className={shared.empty}><span className={shared.emptyEmoji}>📸</span>No memories yet. Add your first photo or video together!</div>
        )}

        {memories.map((m) => {
          const mine = m.created_by === user?.id;
          return (
            <article key={m.id} className={styles.memoryCard}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.memoryDate}>{formatLongDate(m.memory_date)}</span>
                  <h3 className={styles.memoryTitle}>{m.title}</h3>
                </div>
                {mine && (
                  <KebabMenu
                    actions={[
                      { label: 'Edit', onClick: () => openEdit(m) },
                      { label: 'Delete', danger: true, onClick: () => setDeleting(m) },
                    ]}
                  />
                )}
              </div>

              <div className={styles.meta}>
                <span className={shared.authorTag}>📍 Added by {nameFor(m.created_by)}</span>
              </div>

              {m.image_path && (
                <button className={styles.mediaBtn} onClick={() => openViewer(m.id)} aria-label={`Open ${m.title} full screen`}>
                  {!m.mediaUrl ? (
                    <div className={styles.mediaPlaceholder}>Couldn't load this {m.media_type ?? 'file'}</div>
                  ) : m.media_type === 'video' ? (
                    <>
                      <video className={styles.media} src={`${m.mediaUrl}#t=0.1`} preload="metadata" muted playsInline />
                      <span className={styles.playBadge}><span className={styles.playCircle}>▶</span></span>
                    </>
                  ) : (
                    <>
                      <img className={styles.media} src={m.mediaUrl} alt={m.title} loading="lazy" />
                      <span className={styles.expandHint}>⤢ Full screen</span>
                    </>
                  )}
                </button>
              )}

              {m.description && <p className={styles.memoryDescription}>{m.description}</p>}

              <ReplyThread
                parentId={m.id}
                replies={replies.byParent[m.id] ?? []}
                onAdd={replies.add}
                onEdit={replies.edit}
                onRemove={replies.remove}
                previewCount={2}
              />
            </article>
          );
        })}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete this memory?"
          message={`"${deleting.title}"${deleting.image_path ? ' and its ' + (deleting.media_type === 'video' ? 'video' : 'photo') : ''} will be removed for both of you, along with all replies. This can't be undone.`}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}

      {viewerIndex !== null && <MediaViewer items={viewerItems} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    </div>
  );
};
