import { useEffect } from 'react';
import ui from './ui.module.css';

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal = ({ title, onClose, children }: ModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind the sheet
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={ui.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={ui.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={ui.sheetHeader}>
          <h2 className={ui.sheetTitle}>{title}</h2>
          <button className={ui.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={ui.sheetBody}>{children}</div>
      </div>
    </div>
  );
};
