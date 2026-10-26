import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import styles from './Memories.module.css';

interface Memory {
  id: string;
  title: string;
  description: string;
  memory_date: string;
  image_path: string | null;
  imageUrl?: string; // We will generate this temporarily on the client
}

export const Memories = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [memoryDate, setMemoryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (relationshipId) fetchMemories();
  }, [relationshipId]);

  const fetchMemories = async () => {
    // 1. Fetch text data from database
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('memory_date', { ascending: false }); // Newest first

    if (error || !data) return;

    // 2. Generate secure temporary viewing URLs for each image
    const processedMemories = await Promise.all(
      data.map(async (m) => {
        if (m.image_path) {
          // Generates a URL valid for 1 hour (3600 seconds)
          const { data: urlData } = await supabase.storage
            .from('relationship_media')
            .createSignedUrl(m.image_path, 3600);
          return { ...m, imageUrl: urlData?.signedUrl };
        }
        return m;
      })
    );

    setMemories(processedMemories);
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setLoading(true);

    let imagePath = null;

    // Upload image if selected
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      // Store in a folder named after the relationship ID to match our security policy
      imagePath = `${relationshipId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('relationship_media')
        .upload(imagePath, file);

      if (uploadError) {
        alert('Failed to upload image. Please try again.');
        setLoading(false);
        return;
      }
    }

    // Insert database record
    const { error } = await supabase.from('memories').insert([
      {
        relationship_id: relationshipId,
        created_by: user.id,
        title,
        description,
        memory_date: memoryDate,
        image_path: imagePath
      }
    ]);

    if (!error) {
      setTitle('');
      setDescription('');
      setMemoryDate('');
      setFile(null);
      setIsAdding(false);
      fetchMemories();
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Our Memories</h1>
        {!isAdding && (
          <button className={styles.addButton} onClick={() => setIsAdding(true)}>
            + Add Memory
          </button>
        )}
      </header>

      {isAdding && (
        <form onSubmit={handleAddMemory} className={styles.formCard}>
          <div className={styles.inputGroup}>
            <label>Title</label>
            <input type="text" className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Our First Trip to Cape Town" required />
          </div>
          <div className={styles.inputGroup}>
            <label>Date</label>
            <input type="date" className={styles.input} value={memoryDate} onChange={e => setMemoryDate(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Photo (Optional)</label>
            <input type="file" accept="image/*" className={styles.fileInput} onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className={styles.inputGroup}>
            <label>The Story</label>
            <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} placeholder="Write something special about this day..." />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.addButton} style={{ backgroundColor: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }} onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.addButton} style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Memory'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.timeline}>
        {memories.length === 0 && !isAdding && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: '1rem' }}>No memories yet. Upload your first photo together!</p>
        )}
        
        {memories.map((memory) => (
          <div key={memory.id} className={styles.memoryCard}>
            <span className={styles.memoryDate}>{new Date(memory.memory_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <h3 className={styles.memoryTitle}>{memory.title}</h3>
            {memory.imageUrl && (
              <img src={memory.imageUrl} alt={memory.title} className={styles.memoryImage} loading="lazy" />
            )}
            {memory.description && <p className={styles.memoryDescription}>{memory.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};