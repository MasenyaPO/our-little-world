import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRelationship } from '../hooks/useRelationship';
import styles from './Login.module.css'; // Reusing our neat card styles

export const Onboarding = () => {
  const { refresh } = useRelationship();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [relName, setRelName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('create_relationship', {
        rel_name: relName,
        rel_start_date: startDate
      });
      if (error) throw error;
      await refresh(); // Updates context, moving user to the Dashboard
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.rpc('join_relationship', {
        invite_code: inviteCode
      });
      if (error) throw error;
      await refresh(); // Updates context, moving user to the Dashboard
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome!</h1>
        <p className={styles.subtitle}>You are not in a relationship space yet.</p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            className={styles.button} 
            style={{ flex: 1, backgroundColor: mode === 'create' ? 'var(--color-primary)' : 'var(--color-border)', color: mode === 'create' ? 'white' : 'var(--color-text-main)' }}
            onClick={() => setMode('create')}
          >
            Create Space
          </button>
          <button 
            className={styles.button} 
            style={{ flex: 1, backgroundColor: mode === 'join' ? 'var(--color-primary)' : 'var(--color-border)', color: mode === 'join' ? 'white' : 'var(--color-text-main)' }}
            onClick={() => setMode('join')}
          >
            Join Space
          </button>
        </div>

        {error && <div className={styles.error} style={{ marginBottom: '1rem' }}>{error}</div>}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>What do you call your relationship? (e.g. "Us")</label>
              <input type="text" value={relName} onChange={e => setRelName(e.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <label>When did you start dating?</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'Creating...' : 'Create Space'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Enter Invite Code</label>
              <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="e.g. 123456" required />
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'Joining...' : 'Join Space'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};