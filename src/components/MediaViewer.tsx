import { useCallback, useEffect, useRef, useState } from 'react';
import ui from './ui/ui.module.css';

export interface ViewerItem {
  id: string;
  url: string;
  kind: 'image' | 'video';
  title?: string;
  caption?: string | null;
}

interface Props {
  items: ViewerItem[];
  startIndex: number;
  onClose: () => void;
}

/** Full-screen photo/video viewer: swipe or arrow keys to move, tap photo to zoom, Esc to close. */
export const MediaViewer = ({ items, startIndex, onClose }: Props) => {
  const [index, setIndex] = useState(startIndex);
  const [zoomed, setZoomed] = useState(false);
  const touchX = useRef<number | null>(null);
  const item = items[index];

  const go = useCallback((delta: number) => {
    setZoomed(false);
    setIndex((i) => Math.min(items.length - 1, Math.max(0, i + delta)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  if (!item) return null;

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || zoomed) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  };

  return (
    <div className={ui.viewer} role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className={ui.viewerBar}>
        <div>
          <div className={ui.viewerTitle}>{item.title}</div>
          {items.length > 1 && <div className={ui.viewerCount}>{index + 1} / {items.length}</div>}
        </div>
        <div className={ui.viewerBtns}>
          <a className={ui.viewerBtn} href={item.url} download target="_blank" rel="noreferrer">Save</a>
          <button className={ui.viewerBtn} onClick={onClose}>✕ Close</button>
        </div>
      </div>

      <div
        className={ui.stage}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={onTouchEnd}
      >
        {index > 0 && <button className={`${ui.navBtn} ${ui.navPrev}`} onClick={() => go(-1)} aria-label="Previous">‹</button>}
        {item.kind === 'image' ? (
          <img
            key={item.id}
            src={item.url}
            alt={item.title ?? ''}
            className={`${ui.stageImg} ${zoomed ? ui.stageImgZoom : ''}`}
            onClick={() => setZoomed((z) => !z)}
            draggable={false}
          />
        ) : (
          <video key={item.id} src={item.url} className={ui.stageVideo} controls autoPlay playsInline />
        )}
        {index < items.length - 1 && <button className={`${ui.navBtn} ${ui.navNext}`} onClick={() => go(1)} aria-label="Next">›</button>}
      </div>

      {item.caption && <div className={ui.viewerCaption}>{item.caption}</div>}
    </div>
  );
};
