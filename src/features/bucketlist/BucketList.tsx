import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import { formatShortDate, parseLocalDate, startOfToday } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { KebabMenu } from '../../components/ui/KebabMenu';
import styles from './BucketList.module.css';
import shared from '../../styles/shared.module.css';

interface BucketItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  is_completed: boolean;
  completed_at: string | null;
  target_date: string | null;
  created_at: string;
}

const CATEGORIES = ['Travel', 'Food', 'Activity', 'Goal', 'Other'];

export const BucketList = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BucketItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BucketItem | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [filter, setFilter] = useState<string>('All');
  const [surprise, setSurprise] = useState<BucketItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetDate, setTargetDate] = useState('');

  const fetchItems = useCallback(async () => {
    if (!relationshipId) return;
    const { data, error: err } = await supabase
      .from('bucket_list_items')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: false });
    if (!err && data) setItems(data as BucketItem[]);
    setLoaded(true);
  }, [relationshipId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const resetForm = () => {
    setFormOpen(false); setEditing(null); setTitle(''); setDescription(''); setCategory(CATEGORIES[0]); setTargetDate(''); setError(null);
  };

  const openEdit = (it: BucketItem) => {
    setEditing(it); setTitle(it.title); setDescription(it.description ?? ''); setCategory(it.category || 'Other');
    setTargetDate(it.target_date ?? ''); setError(null); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setSaving(true);
    setError(null);

    const payload = { title: title.trim(), description: description.trim() || null, category, target_date: targetDate || null };
    const { error: err } = editing
      ? await supabase.from('bucket_list_items').update(payload).eq('id', editing.id)
      : await supabase.from('bucket_list_items').insert([{ relationship_id: relationshipId, created_by: user.id, ...payload }]);

    if (err) setError(friendlyError(err));
    else { resetForm(); await fetchItems(); }
    setSaving(false);
  };

  const toggleComplete = async (item: BucketItem) => {
    const done = !item.is_completed;
    const completed_at = done ? new Date().toISOString() : null;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_completed: done, completed_at } : i))); // optimistic
    setSurprise(null);
    const { error: err } = await supabase.from('bucket_list_items').update({ is_completed: done, completed_at }).eq('id', item.id);
    if (err) { setError(friendlyError(err)); }
    fetchItems();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error: err } = await supabase.from('bucket_list_items').delete().eq('id', deleting.id);
    if (err) setError(friendlyError(err));
    setDeleting(null);
    fetchItems();
  };

  const pending = useMemo(() => items.filter((i) => !i.is_completed), [items]);
  const done = useMemo(() => items.filter((i) => i.is_completed), [items]);
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;

  const shown = useMemo(() => {
    const base = activeTab === 'pending' ? [...pending] : [...done];
    const filtered = filter === 'All' ? base : base.filter((i) => i.category === filter);
    if (activeTab === 'pending') {
      // items with a target date first (soonest first), then the rest newest-first
      filtered.sort((a, b) => {
        if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    }
    return filtered;
  }, [activeTab, pending, done, filter]);

  const pickSurprise = () => {
    if (pending.length === 0) return;
    setSurprise(pending[Math.floor(Math.random() * pending.length)]);
  };

  const usedCategories = ['All', ...CATEGORIES.filter((c) => items.some((i) => i.category === c))];

  return (
    <div className={shared.container}>
      <header className={shared.header}>
        <h1 className={shared.title}>Our Plans</h1>
        {!formOpen && <button className={shared.btn} onClick={() => setFormOpen(true)}>+ Add Idea</button>}
      </header>

      {formOpen && (
        <form onSubmit={handleSave} className={shared.formCard}>
          <h2 className={shared.formTitle}>{editing ? 'Edit plan' : 'New plan'}</h2>
          <div className={shared.inputGroup}>
            <label>What do you want to do?</label>
            <input className={shared.input} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className={shared.row}>
            <div className={shared.inputGroup}>
              <label>Category</label>
              <select className={shared.select} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={shared.inputGroup}>
              <label>Aim for (Optional)</label>
              <input type="date" className={shared.input} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div className={shared.inputGroup}>
            <label>Details (Optional)</label>
            <textarea className={shared.textarea} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <div className={shared.error}>{error}</div>}
          <div className={shared.formActions}>
            <button type="button" className={`${shared.btn} ${shared.btnGhost}`} onClick={resetForm}>Cancel</button>
            <button type="submit" className={shared.btn} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Save Idea'}</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className={shared.error}>{error}</div>}

      {items.length > 0 && !formOpen && (
        <div className={`${shared.card} ${styles.progressCard}`}>
          <div className={styles.progressTop}>
            <strong>{done.length} of {items.length} done</strong>
            <span className={shared.muted}>{pct}%</span>
          </div>
          <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className={shared.tabs}>
        <button className={`${shared.tab} ${activeTab === 'pending' ? shared.tabActive : ''}`} onClick={() => setActiveTab('pending')}>Pending ({pending.length})</button>
        <button className={`${shared.tab} ${activeTab === 'completed' ? shared.tabActive : ''}`} onClick={() => setActiveTab('completed')}>Completed ({done.length})</button>
      </div>

      {usedCategories.length > 2 && (
        <div className={shared.chips}>
          {usedCategories.map((c) => (
            <button key={c} className={`${shared.chip} ${filter === c ? shared.chipActive : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      )}

      {activeTab === 'pending' && pending.length > 1 && (
        <div className={styles.surprise}>
          <span className={styles.surpriseText}>
            {surprise ? <>How about: <strong>{surprise.title}</strong>?</> : "Can't decide what to do next?"}
          </span>
          <button className={`${shared.btn} ${shared.btnSmall}`} onClick={pickSurprise}>🎲 {surprise ? 'Another' : 'Surprise us'}</button>
        </div>
      )}

      <div className={styles.list}>
        {loaded && shown.length === 0 && !formOpen && (
          <div className={shared.empty}>
            <span className={shared.emptyEmoji}>{activeTab === 'pending' ? '✨' : '🏆'}</span>
            {activeTab === 'pending' ? "No pending ideas. Let's plan something fun!" : "You haven't completed anything here yet."}
          </div>
        )}

        {shown.map((item) => {
          const overdue = !item.is_completed && item.target_date && parseLocalDate(item.target_date) < startOfToday();
          return (
            <div key={item.id} className={`${styles.itemCard} ${item.is_completed ? styles.completed : ''}`}>
              <input type="checkbox" className={styles.check} checked={item.is_completed} onChange={() => toggleComplete(item)} aria-label={`Mark "${item.title}" as ${item.is_completed ? 'not done' : 'done'}`} />
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.categoryTag}>{item.category}</span>
                </div>
                {item.description && <p className={styles.itemDescription}>{item.description}</p>}
                <div className={styles.itemMeta}>
                  {item.is_completed && item.completed_at && <span>✅ Done {formatShortDate(new Date(item.completed_at))}</span>}
                  {!item.is_completed && item.target_date && (
                    <span className={overdue ? styles.overdue : undefined}>🎯 {overdue ? 'Was aiming for' : 'Aiming for'} {formatShortDate(item.target_date)}</span>
                  )}
                </div>
              </div>
              <KebabMenu
                actions={[
                  { label: 'Edit', onClick: () => openEdit(item) },
                  { label: 'Delete', danger: true, onClick: () => setDeleting(item) },
                ]}
              />
            </div>
          );
        })}
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete this plan?"
          message={`"${deleting.title}" will be removed for both of you.`}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
