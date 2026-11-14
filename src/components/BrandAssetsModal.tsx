import { Modal } from './Modal';
import React, { useState } from 'react';
import { X, Download, Copy, Check, ExternalLink, Palette, Type } from 'lucide-react';

interface BrandAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const runCrewArt = [
  { name: 'Transparent', file: 'Woodchucker2026.png', size: '468 × 355', detail: 'Black artwork with a transparent background. Use on light backgrounds.', background: '#f5f5f4', transparent: true },
  { name: 'Black on cream', file: 'Woodchucker2026-black-cream.png', size: '468 × 355', detail: 'Black artwork on a solid cream background. Also used in the app’s launch artwork.', background: '#faf2ee' },
  { name: 'Cream + teal border', file: 'Woodchucker2026-black-cream-teal-border.png', size: '508 × 395', detail: 'Cream artwork framed by a teal border. The border is part of the image.', background: '#faf2ee' },
  { name: 'Black on teal', file: 'Woodchucker2026-black-teal.png', size: '468 × 355', detail: 'Black artwork on the club’s solid teal background.', background: '#1a607c' },
  { name: 'White on teal', file: 'Woodchucker2026-white-teal.png', size: '468 × 355', detail: 'White artwork on the club’s solid teal background.', background: '#1a607c' },
];

const brandColors = [
  { name: 'Blue Note Teal', hex: '#1A607C', role: 'Primary club color', light: false },
  { name: 'Craft Amber', hex: '#DE9C1E', role: 'Warm accent', light: true },
  { name: 'Alabaster Cream', hex: '#FAF2EE', role: 'Artwork background', light: true },
  { name: 'Bottle Cap Midnight', hex: '#0D1113', role: 'Ink and contrast', light: false },
  { name: 'Marine Tint', hex: '#EDF7FA', role: 'Light app surfaces', light: true },
];

const typefaces = [
  { name: 'Oswald', role: 'Headings', style: 'font-display font-bold uppercase', sample: 'Woodland Woodchuckers' },
  { name: 'Outfit', role: 'Stats and accents', style: 'font-sport font-extrabold', sample: 'Every mile counts.' },
  { name: 'Plus Jakarta Sans', role: 'Body and interface', style: 'font-sans font-semibold', sample: 'All paces welcome.' },
];

const downloadStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-woodland-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-woodland-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-woodland-600';
const viewStyle = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50';
const checkerboard = {
  backgroundImage: 'conic-gradient(#e7e5e4 25%, #fafaf9 0 50%, #e7e5e4 0 75%, #fafaf9 0)',
  backgroundSize: '20px 20px',
};

export const BrandAssetsModal: React.FC<BrandAssetsModalProps> = ({ isOpen, onClose }) => {
  const [selectedArt, setSelectedArt] = useState(0);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const artwork = runCrewArt[selectedArt];

  if (!isOpen) return null;

  const copyColor = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setCopyStatus(`${hex} copied.`);
    } catch {
      setCopiedHex(null);
      setCopyStatus(`Copy is unavailable. Select and copy this code: ${hex}`);
    }
  };

  return (
    <Modal title="Club brand assets" onClose={onClose} className="fixed inset-0 z-[1100] flex items-center justify-center bg-stone-950/70 p-2 sm:p-4">
      <div className="flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-4xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:max-h-[92dvh]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-woodland-700 bg-woodland-950 px-4 py-4 text-white sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-woodchuck-300">Woodland Woodchuckers · Est. 2018</p>
            <h2 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide">Logos &amp; Brand</h2>
            <p className="mt-1 text-xs text-woodland-200">Club artwork, colors and app typography.</p>
          </div>
          <button type="button" aria-label="Close window" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-woodland-200 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-4 sm:space-y-9 sm:p-6">
          <section aria-labelledby="run-crew-art-title" className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-woodland-700">2026 Run Crew</p>
              <h3 id="run-crew-art-title" className="mt-1 text-lg font-extrabold text-stone-900">Choose your artwork</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">The running woodchuck, with the club’s original lettering. Choose a background to preview and download the matching file.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <figure className="overflow-hidden rounded-2xl border border-stone-200">
                <div className="flex aspect-[4/3] items-center justify-center p-5 sm:p-6" style={artwork.transparent ? checkerboard : { backgroundColor: artwork.background }}>
                  <img src={`/${artwork.file}`} alt={`2026 Run Crew logo — ${artwork.name.toLowerCase()}`} className="h-full w-full object-contain" />
                </div>
                <figcaption className="flex flex-wrap items-center justify-between gap-1 border-t border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
                  <span className="font-bold text-stone-800">{artwork.name}</span>
                  <span>PNG · {artwork.size} px</span>
                </figcaption>
              </figure>
              <div className="min-w-0 space-y-4">
                <div role="group" aria-label="Run Crew artwork variants" className="grid grid-cols-1 gap-2 min-[375px]:grid-cols-2">
                  {runCrewArt.map((item, index) => (
                    <button key={item.file} type="button" aria-pressed={selectedArt === index} onClick={() => setSelectedArt(index)} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition ${selectedArt === index ? 'border-woodland-600 bg-woodland-50 text-woodland-900 ring-1 ring-woodland-600' : 'border-stone-200 text-stone-600 hover:border-woodland-300 hover:bg-stone-50'}`}>
                      <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-stone-300" style={item.transparent ? checkerboard : { backgroundColor: item.background }} />
                      <span className="min-w-0 flex-1">{item.name}</span>
                      {selectedArt === index && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-woodland-700" />}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-stone-600" aria-live="polite">{artwork.detail}</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`/${artwork.file}`} download={artwork.file} className={downloadStyle}><Download className="h-4 w-4 shrink-0" />Download PNG</a>
                  <a href={`/${artwork.file}`} target="_blank" rel="noreferrer" aria-label={`View ${artwork.name.toLowerCase()} Run Crew artwork in a new tab`} className={viewStyle}>View image<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-500">The checkerboard shows transparency and is not included in the downloaded image.</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="club-marks-title" className="space-y-4">
            <h3 id="club-marks-title" className="text-lg font-extrabold text-stone-900">Club marks</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: 'Woodchuck app icon', file: 'woodland_woodchucker_app_icon-teal.png', format: 'PNG', size: '960 × 960', detail: 'The current smiling woodchuck mark, with white lettering on teal. A square image for club profile pictures and digital graphics.' },
                { title: 'Original bottle cap', file: 'Woodchucker2.jpg', format: 'JPG', size: '960 × 960', detail: 'The heritage Blue Note Brewing Co. emblem, with the original bottle cap, woodchuck face and hop details.' },
              ].map((mark) => (
                <article key={mark.file} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200">
                  <div className="flex h-52 items-center justify-center bg-[#1a607c] p-5 sm:h-60">
                    <img src={`/${mark.file}`} alt={mark.title} loading="lazy" className="h-full max-w-full object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col items-start gap-3 p-4">
                    <div><h4 className="font-bold text-stone-900">{mark.title}</h4><p className="mt-1 text-xs text-stone-500">{mark.format} · {mark.size} px · Solid background</p></div>
                    <p className="flex-1 text-xs leading-relaxed text-stone-600">{mark.detail}</p>
                    <a href={`/${mark.file}`} download={mark.file} aria-label={`Download ${mark.title.toLowerCase()} ${mark.format}`} className={downloadStyle}><Download className="h-4 w-4 shrink-0" />Download {mark.format}</a>
                    {mark.format === 'PNG' && <a href="/woodland_woodchucker_app_icon.png" download="woodland_woodchucker_app_icon.png" className="py-1 text-xs font-semibold text-woodland-800 underline underline-offset-2">Download transparent version · PNG</a>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="brand-colors-title" className="space-y-4">
            <div className="flex items-start gap-2"><Palette className="mt-1 h-5 w-5 shrink-0 text-woodland-700" /><div><h3 id="brand-colors-title" className="text-lg font-extrabold text-stone-900">Club colors</h3><p className="mt-1 text-xs text-stone-600">Tap a swatch to copy its hex code.</p></div></div>
            <div className="grid grid-cols-1 gap-3 min-[375px]:grid-cols-2 lg:grid-cols-5">
              {brandColors.map((color) => (
                <button key={color.hex} type="button" onClick={() => { void copyColor(color.hex); }} aria-label={`Copy ${color.name} ${color.hex}`} className="overflow-hidden rounded-xl border border-stone-200 text-left transition hover:border-woodland-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-woodland-600">
                  <span className={`flex h-20 items-end justify-between gap-2 p-3 text-xs font-bold ${color.light ? 'text-stone-900' : 'text-white'}`} style={{ backgroundColor: color.hex }}><span className="select-all font-mono">{color.hex}</span>{copiedHex === color.hex ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}</span>
                  <span className="block p-3"><span className="block text-xs font-bold text-stone-900">{color.name}</span><span className="mt-1 block text-[11px] text-stone-500">{color.role}</span></span>
                </button>
              ))}
            </div>
            <p role="status" className="select-text text-xs font-semibold text-woodland-800">{copyStatus}</p>
          </section>

          <section aria-labelledby="brand-type-title" className="space-y-4">
            <div className="flex items-start gap-2"><Type className="mt-1 h-5 w-5 shrink-0 text-woodland-700" /><div><h3 id="brand-type-title" className="text-lg font-extrabold text-stone-900">App typography</h3><p className="mt-1 text-xs text-stone-600">These fonts are used in the app. The lettering in each logo stays part of the artwork.</p></div></div>
            <div className="grid gap-3 md:grid-cols-3">{typefaces.map((font) => <article key={font.name} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{font.role}</p><h4 className={`mt-2 text-xl text-stone-900 ${font.style}`}>{font.name}</h4><p className={`mt-3 text-base text-woodland-800 ${font.style}`}>{font.sample}</p></article>)}</div>
          </section>

          <aside className="space-y-2 rounded-xl border border-woodland-200 bg-woodland-50 p-4 text-xs leading-relaxed text-woodland-900">
            <h3 className="font-bold">Using the artwork</h3>
            <p>Keep the original proportions and leave clear space around the logo. Use the supplied color versions rather than stretching or recoloring the artwork.</p>
            <p>These downloads are PNG and JPG images, not vector files. For large prints or embroidery, check the original pixel dimensions with your printer before ordering.</p>
          </aside>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
          <p className="text-[11px] text-stone-500">Woodland, California · Blue Note Brewing Co.</p>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white hover:bg-stone-800">Done</button>
        </footer>
      </div>
    </Modal>
  );
};
