import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import styles from './ImportantDates.module.css';

interface ImportantDate {
  id: string;
  title: string;
  description: string;
  event_date: string;
  recurrence: 'once' | 'annual' | 'monthly';
  daysRemaining?: number;
}

export const ImportantDates = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [recurrence, setRecurrence] = useState<'once' | 'annual' | 'monthly'>('annual');

  useEffect(() => {
    if (relationshipId) fetchDates();
  }, [relationshipId]);

  const fetchDates = async () => {
    const { data, error } = await supabase
      .from('important_dates')
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('event_date', { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    // Calculate days remaining for each date so we can sort them
    const processedDates = (data as ImportantDate[]).map(dateObj => {
      return {
        ...dateObj,
        daysRemaining: calculateDaysRemaining(dateObj.event_date, dateObj.recurrence)
      };
    });

    // Sort by days remaining (closest upcoming event first)
    processedDates.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));
    setDates(processedDates);
  };

  const calculateDaysRemaining = (dateString: string, rec: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate day math
    const eventDateObj = new Date(dateString);

    let nextOccurrence = new Date(eventDateObj);

    if (rec === 'annual') {
      nextOccurrence.setFullYear(today.getFullYear());
      if (nextOccurrence < today) {
        nextOccurrence.setFullYear(today.getFullYear() + 1);
      }
    } else if (rec === 'monthly') {
      nextOccurrence.setFullYear(today.getFullYear());
      nextOccurrence.setMonth(today.getMonth());
      if (nextOccurrence < today) {
        nextOccurrence.setMonth(today.getMonth() + 1);
      }
    }

    const diffTime = nextOccurrence.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user) return;
    setLoading(true);

    const { error } = await supabase.from('important_dates').insert([
      {
        relationship_id: relationshipId,
        created_by: user.id,
        title,
        event_date: eventDate,
        recurrence
      }
    ]);

    if (!error) {
      setTitle('');
      setEventDate('');
      setRecurrence('annual');
      setIsAdding(false);
      fetchDates();
    }
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Important Dates</h1>
        {!isAdding && (
          <button className={styles.addButton} onClick={() => setIsAdding(true)}>
            + Add Date
          </button>
        )}
      </header>

      {isAdding && (
        <form onSubmit={handleAddDate} className={styles.formCard}>
          <div className={styles.inputGroup}>
            <label>What's the occasion?</label>
            <input 
              type="text" 
              className={styles.input} 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. Muriel's Birthday" 
              required 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Date</label>
            <input 
              type="date" 
              className={styles.input} 
              value={eventDate} 
              onChange={(e) => setEventDate(e.target.value)} 
              required 
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Repeats</label>
            <select 
              className={styles.input} 
              value={recurrence} 
              onChange={(e) => setRecurrence(e.target.value as any)}
            >
              <option value="once">Once (No repeat)</option>
              <option value="annual">Yearly (Anniversary, Birthday)</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelButton} onClick={() => setIsAdding(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Saving...' : 'Save Date'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.dateList}>
        {dates.length === 0 && !isAdding && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '2rem' }}>
            No dates added yet. Let's add your anniversary or a birthday!
          </p>
        )}
        
        {dates.map((d) => {
          const isPast = d.daysRemaining! < 0; // Only happens if recurrence is 'once' and date has passed
          return (
            <div key={d.id} className={`${styles.dateCard} ${isPast ? styles.pastEvent : ''}`}>
              <div className={styles.dateInfo}>
                <h3>{d.title}</h3>
                <div className={styles.dateMeta}>
                  <span>{new Date(d.event_date).toLocaleDateString()}</span>
                  {d.recurrence !== 'once' && (
                    <span className={styles.recurrenceTag}>{d.recurrence}</span>
                  )}
                </div>
              </div>
              <div className={styles.countdown}>
                <span className={styles.daysNumber}>
                  {isPast ? '✓' : d.daysRemaining}
                </span>
                <span className={styles.daysLabel}>
                  {isPast ? 'Passed' : d.daysRemaining === 1 ? 'Day' : 'Days'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};