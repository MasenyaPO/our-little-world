import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import { useProfiles } from '../../hooks/useProfiles';
import { useReplies } from '../../hooks/useReplies';
import { friendlyError } from '../../lib/errors';
import { ReplyThread } from '../../components/ReplyThread';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { KebabMenu } from '../../components/ui/KebabMenu';
import { Modal } from '../../components/ui/Modal';
import styles from './Notes.module.css';
import shared from '../../styles/shared.module.css';

interface Note {
  id: string;
  created_by: string;
  title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

const NOTE_MAX = 2000;

/** Shows the note clamped to a fixed height, and only offers "Read more" if the text really is cut off. */
const ClampedText = ({ text, onMore, className }: { text: string; onMore: () => void; className: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <>
      <div ref={ref} className={className}>{text}</div>
      {overflowing && <button className={shared.btnText} style={{ alignSelf: 'flex-start' }} onClick={onMore}>Read more</button>}
    </>
  );
};

export const Notes = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const { nameFor } = useProfiles();
  const replies = useReplies({ table: 'note_replies', parentColumn: 'note_id' });

  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reading, setReading] = useState<string | null>(null); // id of the note open in the pop-up
  const [deleting, setDeleting] = useState<Note | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!relationshipId) return;
    const { data } = await supabase
      .from('love_notes')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: false });
    if (data) setNotes(data as Note[]);
    setLoaded(true);
  }, [relationshipId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const resetForm = () => { setFormOpen(false); setEditing(null); setTitle(''); setContent(''); setError(null); };

  const openEdit = (n: Note) => {
    setEditing(n); setTitle(n.title ?? ''); setContent(n.content); setError(null); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setSaving(true);
    setError(null);

    const payload = { title: title.trim() || null, content: content.trim() };
    const { error: err } = editing
      ? await supabase.from('love_notes').update(payload).eq('id', editing.id)
      : await supabase.from('love_notes').insert([{ relationship_id: relationshipId, created_by: user.id, ...payload }]);

    if (err) setError(friendlyError(err));
    else { resetForm(); await fetchNotes(); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error: err } = await supabase.from('love_notes').delete().eq('id', deleting.id);
    if (err) setError(friendlyError(err));
    setDeleting(null);
    if (reading === deleting.id) setReading(null);
    fetchNotes();
  };

  const readingNote = notes.find((n) => n.id === reading) ?? null;
  const wasEdited = (n: Note) => new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 2000;

  return (
    <div className={shared.container}>
      <header className={shared.header}>
        <h1 className={shared.title}>Love Notes</h1>
        {!formOpen && <button className={shared.btn} onClick={() => setFormOpen(true)}>+ Write Note</button>}
      </header>

      {formOpen && (
        <form onSubmit={handleSave} className={shared.formCard}>
          <h2 className={shared.formTitle}>{editing ? 'Edit note' : 'New note'}</h2>
          <div className={shared.inputGroup}>
            <label>Title (Optional)</label>
            <input className={shared.input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Just thinking of you" />
          </div>
          <div className={shared.inputGroup}>
            <label>Message</label>
            <textarea className={shared.textarea} style={{ minHeight: 140 }} value={content} maxLength={NOTE_MAX} onChange={(e) => setContent(e.target.value)} placeholder="Write your note here..." required />
            <span className={shared.charCount}>{content.length}/{NOTE_MAX}</span>
          </div>
          {error && <div className={shared.error}>{error}</div>}
          <div className={shared.formActions}>
            <button type="button" className={`${shared.btn} ${shared.btnGhost}`} onClick={resetForm}>Cancel</button>
            <button type="submit" className={shared.btn} disabled={saving || !content.trim()}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Send Note'}</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className={shared.error}>{error}</div>}

      <div className={styles.notesGrid}>
        {loaded && notes.length === 0 && !formOpen && (
          <div className={shared.empty} style={{ gridColumn: '1 / -1' }}>
            <span className={shared.emptyEmoji}>💌</span>No notes yet. Leave a sweet message for them to find!
          </div>
        )}

        {notes.map((note) => {
          const mine = note.created_by === user?.id;
          const count = replies.byParent[note.id]?.length ?? 0;
          return (
            <article key={note.id} className={`${styles.noteCard} ${mine ? styles.noteSent : styles.noteReceived}`}>
              <div className={styles.noteTop}>
                <div>
                  {note.title && <h3 className={styles.noteTitle}>{note.title}</h3>}
                  <span className={styles.noteDate}>
                    {new Date(note.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {wasEdited(note) && <span className={shared.edited}> · edited</span>}
                  </span>
                </div>
                {mine && (
                  <KebabMenu
                    actions={[
                      { label: 'Edit', onClick: () => openEdit(note) },
                      { label: 'Delete', danger: true, onClick: () => setDeleting(note) },
                    ]}
                  />
                )}
              </div>

              <ClampedText text={note.content} className={styles.noteContent} onMore={() => setReading(note.id)} />

              <div className={styles.noteFooter}>
                <span className={styles.footLeft}>
                  <span className={shared.authorTag}>{mine ? '✍️ Written by you' : `💌 From ${nameFor(note.created_by)}`}</span>
                </span>
                <button className={styles.replyBadge} onClick={() => setReading(note.id)}>
                  💬 {count === 0 ? 'Reply' : `${count} ${count === 1 ? 'reply' : 'replies'}`}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {readingNote && (
        <Modal title={readingNote.title || 'Love note'} onClose={() => setReading(null)}>
          <div className={styles.fullMeta}>
            <span className={shared.authorTag}>
              {readingNote.created_by === user?.id ? '✍️ Written by you' : `💌 From ${nameFor(readingNote.created_by)}`}
            </span>
            <span className={shared.muted}>{new Date(readingNote.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <p className={styles.fullContent}>{readingNote.content}</p>
          <ReplyThread
            parentId={readingNote.id}
            replies={replies.byParent[readingNote.id] ?? []}
            onAdd={replies.add}
            onEdit={replies.edit}
            onRemove={replies.remove}
            expanded
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this note?"
          message="It will be removed for both of you, along with its replies. This can't be undone."
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
