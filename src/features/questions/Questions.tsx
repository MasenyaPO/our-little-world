import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import { useProfiles } from '../../hooks/useProfiles';
import { friendlyError } from '../../lib/errors';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { KebabMenu } from '../../components/ui/KebabMenu';
import styles from './Questions.module.css';
import shared from '../../styles/shared.module.css';

interface Question {
  id: string;
  question_text: string;
  category: string;
  relationship_id: string | null; // null = built-in, set = custom question made by one of you
  created_by: string | null;
  created_at?: string;
}

interface Answer {
  question_id: string;
  user_id: string;
  answer_text: string;
}

type Filter = 'all' | 'todo' | 'done' | 'ours';
const ANSWER_MAX = 1000;
const QUESTION_MAX = 200;

export const Questions = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  const { nameFor, partnerName } = useProfiles();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  // answering / editing answers
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null); // question id
  const [editText, setEditText] = useState('');
  const [deletingAnswer, setDeletingAnswer] = useState<Question | null>(null);

  // custom question form (also used to edit)
  const [qFormOpen, setQFormOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [qText, setQText] = useState('');
  const [qSaving, setQSaving] = useState(false);
  const [deletingQ, setDeletingQ] = useState<Question | null>(null);

  const load = useCallback(async () => {
    if (!relationshipId) return;
    const [{ data: qData }, { data: aData }] = await Promise.all([
      supabase.from('daily_questions').select('*'),
      supabase.from('question_answers').select('question_id, user_id, answer_text').eq('relationship_id', relationshipId),
    ]);
    if (qData) setQuestions(qData as Question[]);
    if (aData) setAnswers(aData as Answer[]);
    setLoaded(true);
  }, [relationshipId]);

  useEffect(() => { load(); }, [load]);

  const myAnswerFor = (qid: string) => answers.find((a) => a.question_id === qid && a.user_id === user?.id);
  const partnerAnswerFor = (qid: string) => answers.find((a) => a.question_id === qid && a.user_id !== user?.id);

  const ordered = useMemo(() => {
    const custom = questions.filter((q) => q.relationship_id).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const builtIn = questions.filter((q) => !q.relationship_id);
    return [...custom, ...builtIn];
  }, [questions]);

  const visible = ordered.filter((q) => {
    if (filter === 'todo') return !myAnswerFor(q.id);
    if (filter === 'done') return !!myAnswerFor(q.id);
    if (filter === 'ours') return !!q.relationship_id;
    return true;
  });

  /* ---------- answers ---------- */
  const submitAnswer = async (qid: string) => {
    const text = (drafts[qid] ?? '').trim();
    if (!text || !relationshipId || !user) return;
    setBusyId(qid); setError(null);
    const { error: err } = await supabase.from('question_answers').insert([
      { relationship_id: relationshipId, question_id: qid, user_id: user.id, answer_text: text },
    ]);
    if (err) setError(friendlyError(err));
    else { setDrafts((d) => ({ ...d, [qid]: '' })); await load(); }
    setBusyId(null);
  };

  const saveEditedAnswer = async (qid: string) => {
    const text = editText.trim();
    if (!text || !user) return;
    setBusyId(qid); setError(null);
    const { error: err } = await supabase.from('question_answers').update({ answer_text: text }).eq('question_id', qid).eq('user_id', user.id);
    if (err) setError(friendlyError(err));
    else { setEditingAnswerId(null); await load(); }
    setBusyId(null);
  };

  const removeAnswer = async () => {
    if (!deletingAnswer || !user) return;
    const { error: err } = await supabase.from('question_answers').delete().eq('question_id', deletingAnswer.id).eq('user_id', user.id);
    if (err) setError(friendlyError(err));
    setDeletingAnswer(null);
    await load();
  };

  /* ---------- custom questions ---------- */
  const resetQForm = () => { setQFormOpen(false); setEditingQ(null); setQText(''); setError(null); };

  const openEditQ = (q: Question) => {
    setEditingQ(q); setQText(q.question_text); setQFormOpen(true); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationshipId || !user || !qText.trim()) return;
    setQSaving(true); setError(null);
    const { error: err } = editingQ
      ? await supabase.from('daily_questions').update({ question_text: qText.trim() }).eq('id', editingQ.id)
      : await supabase.from('daily_questions').insert([
          { question_text: qText.trim(), category: 'Ours', relationship_id: relationshipId, created_by: user.id },
        ]);
    if (err) setError(friendlyError(err));
    else { resetQForm(); await load(); if (!editingQ) setFilter('all'); }
    setQSaving(false);
  };

  const removeQuestion = async () => {
    if (!deletingQ) return;
    const { error: err } = await supabase.rpc('delete_custom_question', { qid: deletingQ.id });
    if (err) setError(friendlyError(err));
    setDeletingQ(null);
    await load();
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To answer' },
    { id: 'done', label: 'Answered' },
    { id: 'ours', label: 'Our questions' },
  ];

  return (
    <div className={shared.container}>
      <header className={shared.header}>
        <div>
          <h1 className={shared.title}>Couple Q&A</h1>
          <p className={shared.subtitle}>Answer to unlock your partner's response!</p>
        </div>
        {!qFormOpen && <button className={shared.btn} onClick={() => setQFormOpen(true)}>+ Ask</button>}
      </header>

      {qFormOpen && (
        <form onSubmit={saveQuestion} className={shared.formCard}>
          <h2 className={shared.formTitle}>{editingQ ? 'Edit your question' : 'Ask your own question'}</h2>
          <div className={shared.inputGroup}>
            <label>Question</label>
            <input className={shared.input} value={qText} maxLength={QUESTION_MAX} autoFocus onChange={(e) => setQText(e.target.value)} placeholder="e.g. What's a trip you'd love for us to take?" required />
            <span className={shared.charCount}>{qText.length}/{QUESTION_MAX}</span>
          </div>
          {error && <div className={shared.error}>{error}</div>}
          <div className={shared.formActions}>
            <button type="button" className={`${shared.btn} ${shared.btnGhost}`} onClick={resetQForm}>Cancel</button>
            <button type="submit" className={shared.btn} disabled={qSaving || !qText.trim()}>{qSaving ? 'Saving...' : editingQ ? 'Save question' : 'Add question'}</button>
          </div>
        </form>
      )}

      {!qFormOpen && error && <div className={shared.error}>{error}</div>}

      <div className={shared.chips}>
        {FILTERS.map((f) => (
          <button key={f.id} className={`${shared.chip} ${filter === f.id ? shared.chipActive : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className={styles.questionList}>
        {loaded && visible.length === 0 && (
          <div className={shared.empty}>
            <span className={shared.emptyEmoji}>🎲</span>
            {filter === 'todo' ? 'All caught up! Ask a new question or check back later.' : filter === 'ours' ? 'No custom questions yet. Tap "+ Ask" to write one.' : 'Nothing here yet.'}
          </div>
        )}

        {visible.map((q) => {
          const mine = myAnswerFor(q.id);
          const theirs = partnerAnswerFor(q.id);
          const isCustom = !!q.relationship_id;
          const iAskedIt = isCustom && q.created_by === user?.id;
          const editing = editingAnswerId === q.id;

          return (
            <div key={q.id} className={styles.questionCard}>
              <div className={styles.qTop}>
                <div className={styles.tags}>
                  <span className={styles.categoryTag}>{q.category}</span>
                  {isCustom && <span className={shared.authorTag}>Asked by {nameFor(q.created_by)}</span>}
                </div>
                {iAskedIt && (
                  <KebabMenu
                    actions={[
                      { label: 'Edit question', onClick: () => openEditQ(q) },
                      { label: 'Delete question', danger: true, onClick: () => setDeletingQ(q) },
                    ]}
                  />
                )}
              </div>
              <h3 className={styles.questionText}>{q.question_text}</h3>

              {!mine ? (
                <div className={styles.answerForm}>
                  <textarea
                    className={shared.textarea}
                    style={{ minHeight: 70 }}
                    placeholder="Type your answer..."
                    value={drafts[q.id] || ''}
                    maxLength={ANSWER_MAX}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                  />
                  <button className={shared.btn} disabled={busyId === q.id || !(drafts[q.id] ?? '').trim()} onClick={() => submitAnswer(q.id)}>
                    {busyId === q.id ? 'Locking...' : '🔒 Lock Answer'}
                  </button>
                </div>
              ) : (
                <div className={styles.answers}>
                  <div className={`${styles.answerBox} ${styles.answerMine}`}>
                    <div className={styles.answerHead}>
                      <span className={styles.answerAuthor}>You</span>
                      {!editing && (
                        <span className={styles.answerActions}>
                          <button className={shared.btnText} onClick={() => { setEditingAnswerId(q.id); setEditText(mine.answer_text); }}>Edit</button>
                          <button className={shared.btnText} style={{ color: 'var(--color-danger)' }} onClick={() => setDeletingAnswer(q)}>Delete</button>
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div className={styles.answerForm}>
                        <textarea className={shared.textarea} style={{ minHeight: 70 }} value={editText} maxLength={ANSWER_MAX} autoFocus onChange={(e) => setEditText(e.target.value)} />
                        <div className={shared.formActions}>
                          <button className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`} onClick={() => setEditingAnswerId(null)}>Cancel</button>
                          <button className={`${shared.btn} ${shared.btnSmall}`} disabled={busyId === q.id || !editText.trim()} onClick={() => saveEditedAnswer(q.id)}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.answerText}>{mine.answer_text}</div>
                    )}
                  </div>

                  <div className={styles.answerBox}>
                    <div className={styles.answerHead}><span className={styles.answerAuthor}>{partnerName}</span></div>
                    {theirs ? (
                      <div className={styles.answerText}>{theirs.answer_text}</div>
                    ) : (
                      <div className={styles.lockedAnswer}>Waiting for them to answer...</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deletingAnswer && (
        <ConfirmDialog
          title="Delete your answer?"
          message={`You'll be able to answer again, but ${partnerName}'s answer will be hidden from you until you do.`}
          onCancel={() => setDeletingAnswer(null)}
          onConfirm={removeAnswer}
        />
      )}
      {deletingQ && (
        <ConfirmDialog
          title="Delete this question?"
          message={`"${deletingQ.question_text}"\n\nIt will be removed for both of you, along with both answers. This can't be undone.`}
          onCancel={() => setDeletingQ(null)}
          onConfirm={removeQuestion}
        />
      )}
    </div>
  );
};
