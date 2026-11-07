import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useProfiles } from '../../hooks/useProfiles';
import { parseLocalDate, startOfToday, timeAgo } from '../../lib/dates';
import styles from './Dashboard.module.css';
import shared from '../../styles/shared.module.css';

const MOOD_PRESETS = ['Having a good day ☀️', 'Missing you 🥺', 'Busy today 🏃🏽‍♂️', 'In a playful mood 🤪', 'Thinking of you 💕'];
const MOOD_MAX = 120;

const calcDuration = (startStr: string) => {
  const start = parseLocalDate(startStr);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.max(0, Math.round((startOfToday().getTime() - start.getTime()) / 86_400_000));
  return { years: Math.max(0, years), months, days, totalDays };
};

export const Dashboard = () => {
  const { relationship, isComplete, renameRelationship, regenerateInviteCode } = useRelationship();
  const { me, partner, partnerName, setMyStatus, setPartnerNickname } = useProfiles();

  // rename the space
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // partner nickname
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  // my mood
  const [editingMood, setEditingMood] = useState(false);
  const [moodDraft, setMoodDraft] = useState('');
  const [savingMood, setSavingMood] = useState(false);

  // invite code
  const [copied, setCopied] = useState(false);
  const [busyCode, setBusyCode] = useState(false);

  const duration = relationship ? calcDuration(relationship.start_date) : { years: 0, months: 0, days: 0, totalDays: 0 };

  const saveName = async () => {
    const err = await renameRelationship(nameDraft);
    if (err) setRenameError(err);
    else { setRenaming(false); setRenameError(null); }
  };

  const saveNick = async () => {
    await setPartnerNickname(nickDraft);
    setEditingNick(false);
  };

  const saveMood = async (text: string) => {
    setSavingMood(true);
    await setMyStatus(text);
    setSavingMood(false);
    setEditingMood(false);
  };

  const copyCode = async () => {
    if (!relationship?.invite_code) return;
    try {
      await navigator.clipboard.writeText(relationship.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the code is selectable on screen */ }
  };

  const shareCode = async () => {
    if (!relationship?.invite_code) return;
    const text = `Join our little world 🌍 Open the app, choose "I have a code" and enter: ${relationship.invite_code}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Our Little World', text }); return; } catch { /* cancelled */ }
    }
    copyCode();
  };

  const newCode = async () => {
    setBusyCode(true);
    await regenerateInviteCode();
    setBusyCode(false);
  };

  const initial = (s?: string | null) => (s && s.trim() ? s.trim()[0].toUpperCase() : '?');

  return (
    <div className={shared.container}>
      <header className={styles.hero}>
        {renaming ? (
          <div className={styles.renameRow}>
            <input
              className={styles.renameInput}
              value={nameDraft}
              maxLength={60}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setRenaming(false); }}
            />
            <button className={`${shared.btn} ${shared.btnSmall}`} onClick={saveName}>Save</button>
            <button className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`} onClick={() => { setRenaming(false); setRenameError(null); }}>Cancel</button>
          </div>
        ) : (
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{relationship?.name || 'Our Little World'}</h1>
            <button className={styles.iconBtn} aria-label="Rename space" onClick={() => { setNameDraft(relationship?.name ?? ''); setRenaming(true); }}>✏️</button>
          </div>
        )}
        {renameError && <div className={shared.error} style={{ marginTop: '0.5rem' }}>{renameError}</div>}
        <p className={styles.welcome}>Welcome home.</p>
      </header>

      {/* Waiting for partner: invite code */}
      {!isComplete && relationship?.invite_code && (
        <section className={`${shared.card} ${styles.inviteCard}`}>
          <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>💌 Invite your partner</h2>
          <p className={shared.muted} style={{ marginTop: '0.4rem' }}>
            Send them this code. In the app they choose "I have a code" and enter it.
          </p>
          <div className={styles.code}>{relationship.invite_code}</div>
          <div className={styles.inviteActions}>
            <button className={`${shared.btn} ${shared.btnSmall}`} onClick={copyCode}>{copied ? 'Copied ✓' : 'Copy code'}</button>
            <button className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`} onClick={shareCode}>Share</button>
            <button className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`} onClick={newCode} disabled={busyCode}>New code</button>
          </div>
        </section>
      )}

      {/* Time Together */}
      <section className={shared.card}>
        <h2 className={styles.cardTitle}>⏱️ Time Together</h2>
        <div className={styles.counter}>
          <div className={styles.counterBox}><span className={styles.counterNumber}>{duration.years}</span><span className={styles.counterLabel}>Years</span></div>
          <div className={styles.counterBox}><span className={styles.counterNumber}>{duration.months}</span><span className={styles.counterLabel}>Months</span></div>
          <div className={styles.counterBox}><span className={styles.counterNumber}>{duration.days}</span><span className={styles.counterLabel}>Days</span></div>
        </div>
        <p className={styles.totalDays}>{duration.totalDays.toLocaleString()} days together in total</p>
      </section>

      {/* How are we doing? */}
      <section className={shared.card}>
        <h2 className={styles.cardTitle}>💭 How are we doing?</h2>
        <div className={styles.statusGrid}>
          {/* Me */}
          <div className={styles.profileBox}>
            <div className={styles.avatar}>{initial(me?.display_name)}</div>
            <strong>You</strong>
            <p className={styles.statusText}>{me?.status || 'No status set'}</p>
            {me?.status_updated_at && me.status && <span className={styles.statusAge}>{timeAgo(me.status_updated_at)}</span>}
            {!editingMood && (
              <button
                className={shared.btnText}
                onClick={() => { setMoodDraft(me?.status ?? ''); setEditingMood(true); }}
              >
                How are you feeling?
              </button>
            )}
          </div>

          {/* Partner */}
          <div className={styles.profileBox}>
            <div className={styles.avatar}>{initial(partner ? partnerName : null)}</div>
            {editingNick ? (
              <input
                className={styles.nameInput}
                value={nickDraft}
                maxLength={30}
                autoFocus
                placeholder="Partner"
                onChange={(e) => setNickDraft(e.target.value)}
                onBlur={saveNick}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNick(); if (e.key === 'Escape') setEditingNick(false); }}
              />
            ) : (
              <span className={styles.nameRow}>
                <strong>{partnerName}</strong>
                <button
                  className={styles.iconBtn}
                  aria-label="Change what you call your partner"
                  onClick={() => { setNickDraft(me?.partner_nickname ?? ''); setEditingNick(true); }}
                >✏️</button>
              </span>
            )}
            <p className={styles.statusText}>
              {partner ? partner.status || 'No status set' : 'Waiting to join...'}
            </p>
            {partner?.status_updated_at && partner.status && <span className={styles.statusAge}>{timeAgo(partner.status_updated_at)}</span>}
          </div>
        </div>

        {editingMood && (
          <div className={styles.moodEditor}>
            <div className={shared.chips}>
              {MOOD_PRESETS.map((p) => (
                <button key={p} className={shared.chip} disabled={savingMood} onClick={() => saveMood(p)}>{p}</button>
              ))}
            </div>
            <div className={styles.moodRow}>
              <input
                className={shared.input}
                value={moodDraft}
                maxLength={MOOD_MAX}
                autoFocus
                placeholder="Or write how you feel in your own words..."
                onChange={(e) => setMoodDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && moodDraft.trim()) saveMood(moodDraft); }}
              />
              <button className={`${shared.btn} ${shared.btnSmall}`} disabled={savingMood || !moodDraft.trim()} onClick={() => saveMood(moodDraft)}>Save</button>
              <button className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`} onClick={() => setEditingMood(false)}>✕</button>
            </div>
            <span className={shared.charCount}>{moodDraft.length}/{MOOD_MAX}</span>
          </div>
        )}
      </section>

      <div className={styles.settings}>
        <button className={shared.btnText} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
};
