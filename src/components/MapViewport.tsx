import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Modal } from './Modal';

/** Move a stable portal host so expanding never rebuilds the map or GPS watch. */
export function MapViewport({ title, height, onResize, children }: {
  title: string; height: string; onResize: () => void; children: ReactNode;
}) {
  const resizeRef = useRef(onResize);
  resizeRef.current = onResize;
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mapHost] = useState(() => {
    const host = document.createElement('div');
    host.style.width = '100%'; host.style.height = '100%';
    return host;
  });
  const inlineMapSlot = useRef<HTMLDivElement>(null);
  const fullMapSlot = useRef<HTMLDivElement>(null);
  const fullScreenButton = useRef<HTMLButtonElement>(null);
  const wasFullScreen = useRef(false);

  // Move the portal host, keeping its React children, Leaflet map and GPS watch alive.
  useLayoutEffect(() => {
    const target = isFullScreen ? fullMapSlot.current : inlineMapSlot.current;
    target?.appendChild(mapHost);
    resizeRef.current();
    if (wasFullScreen.current && !isFullScreen) fullScreenButton.current?.focus();
    wasFullScreen.current = isFullScreen;
  }, [isFullScreen, mapHost]);
  useLayoutEffect(() => () => { mapHost.remove(); }, [mapHost]);

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => resizeRef.current());
    observer.observe(mapHost);
    return () => observer.disconnect();
  }, [mapHost]);
  return <>
      {/* The inline slot retains its height while the live map is enlarged. */}
      <div ref={inlineMapSlot} style={{ height }} />
      {isFullScreen && <Modal title={`Full-screen map: ${title}`} onClose={() => setIsFullScreen(false)} className="fixed inset-0 flex flex-col bg-white p-0">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <h2 className="truncate text-sm font-bold text-stone-900">{title}</h2>
          <button type="button" onClick={() => setIsFullScreen(false)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-woodland-800 px-3 py-2 text-sm font-bold text-white"><Minimize2 className="h-4 w-4" />Back to normal</button>
        </div>
        <div ref={fullMapSlot} className="min-h-0 flex-1" />
      </Modal>}
      {createPortal(<div className="relative h-full">
        {children}
        {!isFullScreen && <button ref={fullScreenButton} type="button" onClick={() => setIsFullScreen(true)} aria-label="View map full screen" className="absolute bottom-8 left-3 z-[500] flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold text-stone-800 shadow-md hover:bg-stone-50">
          <Maximize2 className="h-4 w-4" />
          Full screen
        </button>}

      </div>, mapHost)}
  </>;
}
