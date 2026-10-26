import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRelationship } from '../../hooks/useRelationship';
import { useAuth } from '../../hooks/useAuth';
import styles from './Questions.module.css';

interface Question {
  id: string;
  question_text: string;
  category: string;
}

interface Answer {
  question_id: string;
  user_id: string;
  answer_text: string;
}

export const Questions = () => {
  const { relationshipId } = useRelationship();
  const { user } = useAuth();
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  
  // Local state for typing a new answer
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (relationshipId) {
      fetchQuestionsAndAnswers();
    }
  }, [relationshipId]);

  const fetchQuestionsAndAnswers = async () => {
    // 1. Get all questions
    const { data: qData } = await supabase.from('daily_questions').select('*');
    if (qData) setQuestions(qData);

    // 2. Get answers
    const { data: aData } = await supabase
      .from('question_answers')
      .select('question_id, user_id, answer_text')
      .eq('relationship_id', relationshipId);
    
    if (aData) setAnswers(aData);
  };

  const handleSubmit = async (questionId: string) => {
    const answerText = drafts[questionId];
    if (!answerText || !relationshipId || !user) return;
    
    setLoadingId(questionId);
    const { error } = await supabase.from('question_answers').insert([
      {
        relationship_id: relationshipId,
        question_id: questionId,
        user_id: user.id,
        answer_text: answerText
      }
    ]);

    if (!error) {
      setDrafts({ ...drafts, [questionId]: '' });
      await fetchQuestionsAndAnswers();
    }
    setLoadingId(null);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Couple Q&A</h1>
        <p className={styles.subtitle}>Answer to unlock your partner's response!</p>
      </header>

      <div className={styles.questionList}>
        {questions.map((q) => {
          const myAnswer = answers.find(a => a.question_id === q.id && a.user_id === user?.id);
          const partnerAnswer = answers.find(a => a.question_id === q.id && a.user_id !== user?.id);

          return (
            <div key={q.id} className={styles.questionCard}>
              <span className={styles.categoryTag}>{q.category}</span>
              <h3 className={styles.questionText}>{q.question_text}</h3>
              
              {!myAnswer ? (
                <div className={styles.form}>
                  <input 
                    type="text" 
                    className={styles.input}
                    placeholder="Type your answer..."
                    value={drafts[q.id] || ''}
                    onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                  />
                  <button 
                    className={styles.submitButton}
                    disabled={loadingId === q.id || !drafts[q.id]}
                    onClick={() => handleSubmit(q.id)}
                  >
                    {loadingId === q.id ? 'Locking...' : 'Lock Answer'}
                  </button>
                </div>
              ) : (
                <div className={styles.answersContainer}>
                  <div className={styles.answerBox}>
                    <div className={styles.answerAuthor}>You</div>
                    <div className={styles.answerText}>{myAnswer.answer_text}</div>
                  </div>
                  
                  <div className={styles.answerBox}>
                    <div className={styles.answerAuthor}>Partner</div>
                    {partnerAnswer ? (
                      <div className={styles.answerText}>{partnerAnswer.answer_text}</div>
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
    </div>
  );
};