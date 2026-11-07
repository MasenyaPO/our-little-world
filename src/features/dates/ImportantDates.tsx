import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import { nextOccurrence, ordinal, formatShortDate, toDateInput } from '../../lib/dates';
import type { Recurrence } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { KebabMenu } from '../../components/ui/KebabMenu';
import styles from './ImportantDates.module.css';
import shared from '../../styles/shared.module.css';

const CATEGORIES = [
  { id: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂' },
  { id: 'trip', label: 'Trip', emoji: '✈️' },
  { id: 'holiday', label: 'Holiday', emoji: '🎄' },
  { id: 'milestone', label: 'Milestone', emoji: '⭐' },
  { id: 'other', label: 'Other', emoji: '📌' },
];
const emojiFor = (id: string) => CATEGORIES.find((c) => c.id === id)?.emoji ?? '📌';

interface ImportantDate {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  recurrence: Recurrence;
  category: string;
}

export const ImportantDates = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ImportantDate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ImportantDate | null>(null);

  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('annual');
  const [category, setCategory] = useState('anniversary');
  const [description, setDescription] = useState('');

  const fetchDates = useCallback(async () => {
    if (!relationshipId) return;
    const { data, error: err } = await supabase.from('important_dates').select('*').eq('relationship_id', relationshipId);
    if (err) console.error(err);
    else setDates((data ?? []) as ImportantDate[]);
    setLoaded(true);
  }, [relationshipId]);

  useEffect(() => { fetchDates(); }, [fetchDates]);

  const { upcoming, past } = useMemo(() => {
    const withNext = dates.map((d) => ({ ...d, occ: nextOccurrence(d.event_date, d.recurrence) }));
    return {
      upcoming: withNext.filter((d) => d.occ.daysRemaining >= 0).sort((a, b) => a.occ.daysRemaining - b.occ.daysRemaining),
      past: withNext.filter((d) => d.occ.daysRemaining < 0).sort((a, b) => b.occ.next.getTime() - a.occ.next.getTime()),
    };
  }, [dates]);

  const resetForm = () => {
    setFormOpen(false); setEditing(null); setTitle(''); setEventDate(''); setRecurrence('annual');
    setCategory('anniversary'); setDescription(''); setError(null);
  };

  const openAdd = () => { resetForm(); setEventDate(toDateInput(new Date())); setFormOpen(true); };
  const openEdit = (d: ImportantDate) => {
    setEditing(d); setTitle(d.title); setEventDate(d.event_date.slice(0, 10)); setRecurrence(d.recurrence);
    setCategory(d.category || 'other'); setDescription(d.description ?? ''); setError(null); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setSaving(true);
    setError(null);

    const payload = { title: title.trim(), event_date: eventDate, recurrence, category, description: description.trim() || null };
    const { error: err } = editing
      ? await supabase.from('important_dates').update(payload).eq('id', editing.id)
      : await supabase.from('important_dates').insert([{ relationship_id: relationshipId, created_by: user.id, ...payload }]);

    if (err) setError(friendlyError(err));
    else { resetForm(); await fetchDates(); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error: err } = await supabase.from('important_dates').delete().eq('id', deleting.id);
    if (err) setError(friendlyError(err));
    setDeleting(null);
    fetchDates();
  };

  const whenText = (days: number) => (days === 0 ? 'Today! 🎉' : days === 1 ? 'Tomorrow' : `In ${days} days`);

  const renderCard = (d: (typeof upcoming)[number], isPast = false) => {
    const { occ } = d;
    const milestone = d.recurrence === 'annual' && occ.yearsOn && occ.yearsOn > 0 ? `${ordinal(occ.yearsOn)} year` : null;
    return (
      <div key={d.id} className={`${styles.dateCard} ${isPast ? styles.pastEvent : ''} ${occ.daysRemaining === 0 ? styles.today : ''}`}>
        <span className={styles.emoji}>{emojiFor(d.category)}</span>
        <div className={styles.dateInfo}>
          <h3>{d.title}</h3>
          <div className={styles.dateMeta}>
            <span>{formatShortDate(isPast ? d.event_date : occ.next)}</span>
            {d.recurrence !== 'once' && <span className={styles.recurrenceTag}>{d.recurrence === 'annual' ? 'yearly' : 'monthly'}</span>}
            {milestone && <span>· {milestone}</span>}
          </div>
          {d.description && <p className={styles.dateNote}>{d.description}</p>}
        </div>
        <div className={styles.countdown}>
          <span className={styles.daysNumber}>{isPast ? '✓' : occ.daysRemaining}</span>
          <span className={styles.daysLabel}>{isPast ? 'Passed' : occ.daysRemaining === 1 ? 'Day' : 'Days'}</span>
        </div>
        <KebabMenu
          actions={[
            { label: 'Edit', onClick: () => openEdit(d) },
            { label: 'Delete', danger: true, onClick: () => setDeleting(d) },
          ]}
        />
      </div>
    );
  };

  const next = upcoming[0];

  return (
    <div className={shared.container}>
      <header className={shared.header}>
        <h1 className={shared.title}>Important Dates</h1>
        {!formOpen && <button className={shared.btn} onClick={openAdd}>+ Add Date</button>}
      </header>

      {formOpen && (
        <form onSubmit={handleSave} className={shared.formCard}>
          <h2 className={shared.formTitle}>{editing ? 'Edit date' : 'New date'}</h2>
          <div className={shared.inputGroup}>
            <label>What's the occasion?</label>
            <input className={shared.input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Our anniversary" required />
          </div>
          <div className={shared.inputGroup}>
            <label>Type</label>
            <div className={shared.chips}>
              {CATEGORIES.map((c) => (
                <button type="button" key={c.id} className={`${shared.chip} ${category === c.id ? shared.chipActive : ''}`} onClick={() => setCategory(c.id)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className={shared.row}>
            <div className={shared.inputGroup}>
              <label>Date</label>
              <input type="date" className={shared.input} value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </div>
            <div className={shared.inputGroup}>
              <label>Repeats</label>
              <select className={shared.select} value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
                <option value="once">Once</option>
                <option value="annual">Every year</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
          </div>
          <div className={shared.inputGroup}>
            <label>Notes (Optional)</label>
            <textarea className={shared.textarea} style={{ minHeight: 70 }} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Gift ideas, reservation details, a plan..." />
          </div>
          {error && <div className={shared.error}>{error}</div>}
          <div className={shared.formActions}>
            <button type="button" className={`${shared.btn} ${shared.btnGhost}`} onClick={resetForm}>Cancel</button>
            <button type="submit" className={shared.btn} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Save Date'}</button>
          </div>
        </form>
      )}

      {!formOpen && error && <div className={shared.error}>{error}</div>}

      {!formOpen && next && (
        <div className={styles.hero}>
          <span className={styles.heroEmoji}>{emojiFor(next.category)}</span>
          <div>
            <div className={styles.heroLabel}>Next up</div>
            <h2 className={styles.heroTitle}>{next.title}</h2>
            <div className={styles.heroWhen}>{whenText(next.occ.daysRemaining)} · {formatShortDate(next.occ.next)}</div>
          </div>
        </div>
      )}

      {loaded && dates.length === 0 && !formOpen && (
        <div className={shared.empty}><span className={shared.emptyEmoji}>📅</span>No dates added yet. Let's add your anniversary or a birthday!</div>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Upcoming</h2>
          <div className={styles.dateList}>{upcoming.map((d) => renderCard(d))}</div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>Past</h2>
          <div className={styles.dateList}>{past.map((d) => renderCard(d, true))}</div>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this date?"
          message={`"${deleting.title}" will be removed for both of you.`}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
