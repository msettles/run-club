import { useLayoutEffect, useRef, type ReactNode } from 'react';

let scrollLocks = 0;
let previousOverflow = '';

/** Native modal semantics keep keyboard focus and background interaction inside the dialog. */
export function Modal({ title, onClose, className = '', children }: {
  title: string; onClose: () => void; className?: string; children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    if (scrollLocks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || (event.target instanceof Element && event.target.closest('dialog') !== dialog)) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled, [inert], [hidden]') && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', trapFocus);
    dialog.showModal();
    dialog.focus();
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      dialog.close();
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={dialogRef} aria-label={title} aria-modal="true" tabIndex={-1}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    className={className}
    style={{ width: '100%', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: 0, border: 0, color: 'inherit' }}>
    {children}
  </dialog>;
}
