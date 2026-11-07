import { useState } from 'react';
import { Modal } from './Modal';
import ui from './ui.module.css';
import shared from '../../styles/shared.module.css';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export const ConfirmDialog = ({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) => {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onCancel}>
      <p className={ui.confirmText}>{message}</p>
      <div className={ui.confirmActions}>
        <button className={`${shared.btn} ${shared.btnGhost}`} onClick={onCancel} disabled={busy}>Cancel</button>
        <button
          className={`${shared.btn} ${shared.btnDanger}`}
          disabled={busy}
          onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
