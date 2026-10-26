import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import styles from './BucketList.module.css';

interface BucketItem {
  id: string;
  title: string;
  description: string;
  category: string;
  is_completed: boolean;
}

const CATEGORIES = ["Travel", "Food", "Activity", "Goal", "Other"];

export const BucketList = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);

  useEffect(() => {
    if (relationshipId) fetchItems();
  }, [relationshipId]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('bucket_list_items')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setLoading(true);

    const { error } = await supabase.from('bucket_list_items').insert([
      {
        relationship_id: relationshipId,
        created_by: user.id,
        title,
        description,
        category
      }
    ]);

    if (!error) {
      setTitle('');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setIsAdding(false);
      fetchItems();
    }
    setLoading(false);
  };

  const toggleComplete = async (item: BucketItem) => {
    const newStatus = !item.is_completed;
    
    // Optimistic UI update for a snappy feel
    setItems(items.map(i => i.id === item.id ? { ...i, is_completed: newStatus } : i));

    await supabase
      .from('bucket_list_items')
      .update({ 
        is_completed: newStatus,
        completed_at: newStatus ? new Date().toISOString() : null
      })
      .eq('id', item.id);
      
    fetchItems(); // Refresh from server to ensure sync
  };

  const displayedItems = items.filter(item => 
    activeTab === 'pending' ? !item.is_completed : item.is_completed
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Bucket List</h1>
        {!isAdding && (
          <button className={styles.addButton} onClick={() => setIsAdding(true)}>
            + Add Idea
          </button>
        )}
      </header>

      {isAdding && (
        <form onSubmit={handleAddItem} className={styles.formCard}>
          <div className={styles.inputGroup}>
            <label>What do you want to do?</label>
            <input type="text" className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Category</label>
            <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>Details (Optional)</label>
            <textarea className={styles.textarea} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.addButton} style={{ backgroundColor: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }} onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.addButton} style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Idea'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'pending' ? styles.active : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'completed' ? styles.active : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
      </div>

      <div className={styles.list}>
        {displayedItems.length === 0 && !isAdding && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
            {activeTab === 'pending' ? "No pending ideas. Let's plan something fun!" : "You haven't completed any items yet."}
          </p>
        )}

        {displayedItems.map((item) => (
          <div key={item.id} className={`${styles.itemCard} ${item.is_completed ? styles.completed : ''}`}>
            <div className={styles.checkboxContainer}>
              <input 
                type="checkbox" 
                className={styles.checkbox}
                checked={item.is_completed} 
                onChange={() => toggleComplete(item)} 
              />
            </div>
            <div className={styles.itemContent}>
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.categoryTag}>{item.category}</span>
              </div>
              {item.description && <p className={styles.itemDescription}>{item.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};