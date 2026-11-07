import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRelationship } from '../hooks/useRelationship';
import { friendlyError } from '../lib/errors';
import styles from './Login.module.css'; // reusing the card styles

export const Onboarding = () => {
  const { refresh } = useRelationship();
  const [mode, setMode] = useState<'create' | 'join'>('join');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [relName, setRelName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, fallback: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await fn();
      if (error) throw error;
      await refresh(); // moves the user into the app
    } catch (err) {
      setError(friendlyError(err, fallback));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => supabase.rpc('create_relationship', { rel_name: relName.trim(), rel_start_date: startDate }), 'Failed to create space');
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => supabase.rpc('join_relationship', { invite_code: inviteCode.trim().toUpperCase() }), 'Invalid code');
  };

  const signOut = () => supabase.auth.signOut();

  const tabStyle = (active: boolean) => ({
    flex: 1,
    backgroundColor: active ? 'var(--color-primary)' : 'var(--color-border)',
    color: active ? 'white' : 'var(--color-text-main)',
  });

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome! 🌍</h1>
        <p className={styles.subtitle}>
          {mode === 'join'
            ? 'Got a code from your partner? Enter it to step into your shared space.'
            : "Start your space, then share the invite code it gives you with your partner."}
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button type="button" className={styles.button} style={tabStyle(mode === 'join')} onClick={() => { setMode('join'); setError(null); }}>
            I have a code
          </button>
          <button type="button" className={styles.button} style={tabStyle(mode === 'create')} onClick={() => { setMode('create'); setError(null); }}>
            Start a space
          </button>
        </div>

        {error && <div className={styles.error} style={{ marginBottom: '1rem' }}>{error}</div>}

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>What do you call your relationship? (e.g. "Us")</label>
              <input type="text" value={relName} onChange={(e) => setRelName(e.target.value)} maxLength={60} required />
            </div>
            <div className={styles.inputGroup}>
              <label>When did you start dating?</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'Creating...' : 'Create space'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7M2QX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                style={{ letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700 }}
                required
              />
            </div>
            <button type="submit" disabled={loading || inviteCode.trim().length < 4} className={styles.button}>
              {loading ? 'Joining...' : 'Join space'}
            </button>
          </form>
        )}

        <button type="button" className={styles.toggleText} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
};
