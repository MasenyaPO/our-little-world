import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfiles } from '../hooks/useProfiles';
import type { Reply } from '../hooks/useReplies';
import { timeAgo } from '../lib/dates';
import { ConfirmDialog } from './ui/ConfirmDialog';
import ui from './ui/ui.module.css';
import shared from '../styles/shared.module.css';

interface Props {
  parentId: string;
  replies: Reply[];
  onAdd: (parentId: string, content: string) => Promise<string | null>;
  onEdit: (replyId: string, content: string) => Promise<string | null>;
  onRemove: (replyId: string) => Promise<string | null>;
  /** How many of the newest replies to show before "view earlier replies". 0 = show only the box. */
  previewCount?: number;
  /** Show every reply immediately (used inside the "read more" popup for notes). */
  expanded?: boolean;
}

export const ReplyThread = ({ parentId, replies, onAdd, onEdit, onRemove, previewCount = 2, expanded = false }: Props) => {
  const { user } = useAuth();
  const { nameFor } = useProfiles();
  const [showAll, setShowAll] = useState(expanded);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleting, setDeleting] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hidden = showAll ? 0 : Math.max(0, replies.length - previewCount);
  const visible = showAll ? replies : replies.slice(-previewCount);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    const err = await onAdd(parentId, draft);
    if (err) setError(err);
    else setDraft('');
    setSending(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const err = await onEdit(editingId, editText);
    if (err) setError(err);
    else setEditingId(null);
  };

  const renderReply = (r: Reply) => {
    const mine = r.created_by === user?.id;
    const edited = r.updated_at && new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 2000;
    return (
      <div key={r.id} className={`${ui.reply} ${mine ? ui.replyMine : ''}`}>
        <div className={ui.replyHead}>
          <span><span className={ui.replyWho}>{nameFor(r.created_by)}</span> · {timeAgo(r.created_at)}{edited && <span className={shared.edited}> · edited</span>}</span>
          {mine && editingId !== r.id && (
            <span className={ui.replyActions}>
              <button className={shared.btnText} onClick={() => { setEditingId(r.id); setEditText(r.content); }}>Edit</button>
              <button className={shared.btnText} style={{ color: 'var(--color-danger)' }} onClick={() => setDeleting(r)}>Delete</button>
            </span>
          )}
        </div>
        {editingId === r.id ? (
          <div className={ui.replyForm}>
            <textarea className={ui.replyInput} value={editText} maxLength={2000} onChange={(e) => setEditText(e.target.value)} autoFocus />
            <button className={ui.sendBtn} onClick={saveEdit}>Save</button>
            <button className={`${shared.btn} ${shared.btnGhost}`} style={{ height: 40 }} onClick={() => setEditingId(null)}>✕</button>
          </div>
        ) : (
          <div className={ui.replyBody}>{r.content}</div>
        )}
      </div>
    );
  };

  return (
    <div className={ui.thread}>
      {hidden > 0 && (
        <button className={`${shared.btnText} ${ui.moreBtn}`} onClick={() => setShowAll(true)}>
          View {hidden} earlier {hidden === 1 ? 'reply' : 'replies'}
        </button>
      )}
      {replies.length > 0 && (
        // when everything is shown, cap the height and let it scroll so a long chat never stretches the page
        <div className={showAll ? ui.threadScroll : undefined} style={showAll ? undefined : { display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {visible.map(renderReply)}
        </div>
      )}
      {showAll && !expanded && replies.length > previewCount && (
        <button className={`${shared.btnText} ${ui.moreBtn}`} onClick={() => setShowAll(false)}>Show less</button>
      )}

      {error && <div className={shared.error}>{error}</div>}

      <div className={ui.replyForm}>
        <textarea
          className={ui.replyInput}
          placeholder="Write a reply..."
          value={draft}
          maxLength={2000}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button className={ui.sendBtn} onClick={send} disabled={sending || !draft.trim()}>Send</button>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete reply?"
          message="This reply will be removed for both of you."
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            const err = await onRemove(deleting.id);
            if (err) setError(err);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
};
