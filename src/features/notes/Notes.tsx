import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import styles from './Notes.module.css';

interface Note {
  id: string;
  created_by: string;
  title: string | null;
  content: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
}

export const Notes = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (relationshipId) {
      fetchProfiles();
      fetchNotes();
    }
  }, [relationshipId]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, display_name');
    if (data) {
      const profileMap: Record<string, string> = {};
      data.forEach((p: Profile) => {
        profileMap[p.id] = p.display_name || 'Partner';
      });
      setProfiles(profileMap);
    }
  };

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('love_notes')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotes(data);
    }
  };

  const handleSendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setLoading(true);

    const { error } = await supabase.from('love_notes').insert([
      {
        relationship_id: relationshipId,
        created_by: user.id,
        title: title.trim() === '' ? null : title,
        content
      }
    ]);

    if (!error) {
      setTitle('');
      setContent('');
      setIsAdding(false);
      fetchNotes();
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Love Notes</h1>
        {!isAdding && (
          <button className={styles.addButton} onClick={() => setIsAdding(true)}>
            + Write Note
          </button>
        )}
      </header>

      {isAdding && (
        <form onSubmit={handleSendNote} className={styles.formCard}>
          <div className={styles.inputGroup}>
            <label>Title (Optional)</label>
            <input 
              type="text" 
              className={styles.input} 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Just thinking of you" 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Message</label>
            <textarea 
              className={styles.textarea} 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              placeholder="Write your note here..." 
              required 
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.addButton} style={{ backgroundColor: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }} onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.addButton} style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Note'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.notesGrid}>
        {notes.length === 0 && !isAdding && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: '1rem', gridColumn: '1 / -1', textAlign: 'center' }}>
            No notes yet. Leave a sweet message for them to find!
          </p>
        )}

        {notes.map((note) => {
          const isMine = note.created_by === user?.id;
          const authorName = isMine ? 'You' : profiles[note.created_by] || 'Partner';
          
          return (
            <div key={note.id} className={`${styles.noteCard} ${isMine ? styles.noteSent : styles.noteReceived}`}>
              <div className={styles.noteHeader}>
                {note.title && <h3 className={styles.noteTitle}>{note.title}</h3>}
                <span className={styles.noteDate}>
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.noteContent}>
                {note.content}
              </div>
              <div className={styles.noteFooter}>
                {isMine ? 'Sent by you' : `From ${authorName} 💌`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};