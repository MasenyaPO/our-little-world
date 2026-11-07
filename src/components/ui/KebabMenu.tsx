import { useEffect, useRef, useState } from 'react';
import ui from './ui.module.css';

export interface MenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export const KebabMenu = ({ actions }: { actions: MenuAction[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className={ui.kebabWrap} ref={ref}>
      <button className={ui.kebabBtn} onClick={() => setOpen((o) => !o)} aria-label="More options" aria-expanded={open}>
        ⋯
      </button>
      {open && (
        <div className={ui.menu} role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              className={`${ui.menuItem} ${a.danger ? ui.menuDanger : ''}`}
              onClick={() => { setOpen(false); a.onClick(); }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
