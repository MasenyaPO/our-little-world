import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useRelationship } from '../../hooks/useRelationship';
import styles from './Dashboard.module.css';

const STATUS_OPTIONS = [
  "Having a good day ☀️",
  "Missing you 🥺",
  "Busy today 🏃🏽‍♂️",
  "In a playful mood 🤪",
  "Thinking of you 💕"
];

export const Dashboard = () => {
  const { user } = useAuth();
  const { relationshipId } = useRelationship();
  const [relationship, setRelationship] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [duration, setDuration] = useState({ years: 0, months: 0, days: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, [relationshipId]);

  const fetchDashboardData = async () => {
    if (!relationshipId) return;

    // 1. Fetch relationship details (for the name and start date)
    const { data: relData } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', relationshipId)
      .single();
    
    if (relData) {
      setRelationship(relData);
      calculateDuration(relData.start_date);
    }

    // 2. Fetch profiles of both members
    const { data: profData } = await supabase
      .from('profiles')
      .select('*'); // RLS automatically limits this to just the two of you!
      
    if (profData) setProfiles(profData);
  };

  const calculateDuration = (startDateStr: string) => {
    const start = new Date(startDateStr);
    const now = new Date();
    
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    
    setDuration({ years, months, days });
  };

  const updateStatus = async (newStatus: string) => {
    if (!user) return;
    await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id);
    fetchDashboardData(); // Refresh to show the new status
  };

  const myProfile = profiles.find(p => p.id === user?.id);
  const partnerProfile = profiles.find(p => p.id !== user?.id);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{relationship?.name || 'Our Little World'}</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Welcome home.</p>
      </header>

      {/* Time Together Card */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>⏱️ Time Together</h2>
        <div className={styles.counter}>
          <div className={styles.counterBox}>
            <span className={styles.counterNumber}>{duration.years}</span>
            <span className={styles.counterLabel}>Years</span>
          </div>
          <div className={styles.counterBox}>
            <span className={styles.counterNumber}>{duration.months}</span>
            <span className={styles.counterLabel}>Months</span>
          </div>
          <div className={styles.counterBox}>
            <span className={styles.counterNumber}>{duration.days}</span>
            <span className={styles.counterLabel}>Days</span>
          </div>
        </div>
      </section>

      {/* Relationship Status Card */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>💭 How are we doing?</h2>
        <div className={styles.statusGrid}>
          {/* My Profile */}
          <div className={styles.profileBox}>
            <div className={styles.avatar}>
              {myProfile?.display_name ? myProfile.display_name[0].toUpperCase() : 'Me'}
            </div>
            <strong>{myProfile?.display_name || 'Me'}</strong>
            <p className={styles.statusText}>{myProfile?.status || 'No status set'}</p>
            <select 
              className={styles.statusSelect}
              value={myProfile?.status || ''}
              onChange={(e) => updateStatus(e.target.value)}
            >
              <option value="" disabled>Update status...</option>
              {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Partner Profile */}
          <div className={styles.profileBox}>
            <div className={styles.avatar}>
              {partnerProfile?.display_name ? partnerProfile.display_name[0].toUpperCase() : '?'}
            </div>
            <strong>{partnerProfile?.display_name || 'Partner'}</strong>
            <p className={styles.statusText}>
              {partnerProfile ? (partnerProfile.status || 'No status set') : 'Waiting to join...'}
            </p>
          </div>
        </div>
      </section>

      {/* Daily Prompt (Placeholder for now) */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>✨ Today's Thought</h2>
        <p className={styles.placeholderText}>
          "What is a small moment from our past that always makes you smile?"
        </p>
      </section>

      {/* Upcoming & Activity Stubs - To be filled in later stages */}
      <section className={styles.card} style={{ opacity: 0.6 }}>
        <h2 className={styles.cardTitle}>📅 Upcoming</h2>
        <p className={styles.placeholderText}>Important Dates feature coming soon.</p>
      </section>
    </div>
  );
};