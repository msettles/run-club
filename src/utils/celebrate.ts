/** Optional visual feedback must never interrupt a successfully saved check-in. */
export function celebrate(kind: 'check-in' | 'rewards'): void {
  void import('canvas-confetti').then(({ default: confetti }) => {
    const checkIn = kind === 'check-in';
    void confetti({
      particleCount: checkIn ? 90 : 50,
      spread: checkIn ? 80 : 60,
      origin: { y: checkIn ? 0.6 : 0.7 },
      colors: ['#f59e0b', '#2a859e', '#13495d', ...(checkIn ? ['#10b981'] : [])],
      disableForReducedMotion: true,
    });
  }).catch(() => {});
}
