import React, { useState } from 'react';
import { X, Download, Copy, Check, ExternalLink, Sparkles, Palette, Type, Award } from 'lucide-react';

interface BrandAssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BrandAssetsModal: React.FC<BrandAssetsModalProps> = ({ isOpen, onClose }) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const brandColors = [
    {
      name: 'Blue Note Teal',
      role: 'Primary Brand Anchor',
      hex: '#1A607C',
      rgb: 'rgb(26, 96, 124)',
      textDark: false,
      desc: 'Signature bottle cap background and club jersey tone',
    },
    {
      name: 'Craft Beer Amber',
      role: 'Secondary / Accent',
      hex: '#DE9C1E',
      rgb: 'rgb(222, 156, 30)',
      textDark: true,
      desc: 'Malt gold, woodchuck cheeks, and post-run pint foam',
    },
    {
      name: 'Alabaster Cream',
      role: 'Vintage Off-White',
      hex: '#FAF2EE',
      rgb: 'rgb(250, 242, 238)',
      textDark: true,
      border: true,
      desc: 'Woodchuck snout fill and original banner ribbons',
    },
    {
      name: 'Bottle Cap Midnight',
      role: 'Ink Graphic Contrast',
      hex: '#0D1113',
      rgb: 'rgb(13, 17, 19)',
      textDark: false,
      desc: 'Sharp line-art outlines and bold typography',
    },
    {
      name: 'Marine Tint',
      role: 'Light UI Surface',
      hex: '#EDF7FA',
      rgb: 'rgb(237, 247, 250)',
      textDark: true,
      border: true,
      desc: 'App background highlights and subtle card badges',
    },
  ];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-woodland-950 via-woodland-900 to-woodland-800 text-white flex items-center justify-between shrink-0 border-b border-woodland-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 via-woodchuck-500 to-amber-600 border border-amber-300/80 p-1 flex items-center justify-center overflow-hidden shadow-xs">
              <img src="/Woodchucker2026.png" alt="2026 Logo" className="w-full h-full object-contain filter drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-display font-bold tracking-wide uppercase">
                  Club Brand Resources & Logos
                </h2>
                <span className="text-[10px] bg-amber-400 text-stone-950 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Official
                </span>
              </div>
              <p className="text-xs text-woodland-200 mt-0.5 font-medium">
                Woodland Woodchuckers Run Club • Blue Note Brewing Co.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-woodland-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          {/* Intro Notice */}
          <div className="p-4 rounded-xl bg-woodland-50 border border-woodland-200/80 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-woodland-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-woodland-900 leading-relaxed">
              <span className="font-bold">Official Member Resources:</span> Download high-resolution files for
              club singlets, race bibs, stickers, Strava avatars, and social media flyers. All assets honor our
              roots with Blue Note Brewing Co. and celebrate our new 2026 Run Crew mascot!
            </div>
          </div>

          {/* SECTION 1: THE TWO LOGOS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-woodland-700" />
              <h3 className="font-display font-bold text-lg text-stone-900 uppercase tracking-wide">
                Official Club Logos
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LOGO 1: 2026 Run Crew Mascot */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-gradient-to-b from-stone-50/50 to-white flex flex-col justify-between shadow-xs hover:border-woodland-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg">
                      New 2026 Mascot
                    </span>
                    <span className="text-[11px] text-stone-500 font-medium">Transparent PNG • Alpha</span>
                  </div>

                  <div className="h-56 bg-stone-100/70 border border-dashed border-stone-300 rounded-xl flex items-center justify-center p-4 relative group overflow-hidden">
                    {/* Checkerboard hint for transparency */}
                    <div
                      className="absolute inset-0 opacity-15"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)',
                        backgroundSize: '16px 16px',
                        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      }}
                    />
                    <img
                      src="/Woodchucker2026.png"
                      alt="Woodland Woodchuckers 2026 Run Crew Mascot"
                      className="max-h-full max-w-full object-contain relative z-10 transition group-hover:scale-105"
                    />
                  </div>

                  <h4 className="font-bold text-stone-900 text-base mt-4">
                    Woodchucker 2026 Run Crew
                  </h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    The sprinting woodchuck holding a refreshing craft beer mug, wearing the Blue Note tank top,
                    surrounded by dynamic &quot;Woodland Run Crew Woodchuckers&quot; athletic typography. Ideal for
                    white/light jerseys, stickers, and t-shirts.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-2">
                  <a
                    href="/Woodchucker2026.png"
                    download="Woodland_Woodchuckers_2026_Run_Crew.png"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-woodland-600 hover:bg-woodland-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PNG</span>
                  </a>
                  <a
                    href="/Woodchucker2026.png"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition"
                    title="Open full resolution"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* LOGO 2: Original Heritage Bottle Cap */}
              <div className="border border-stone-200 rounded-2xl p-5 bg-gradient-to-b from-stone-50/50 to-white flex flex-col justify-between shadow-xs hover:border-woodland-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider bg-woodland-100 text-woodland-900 px-2.5 py-1 rounded-lg">
                      Original Heritage Logo
                    </span>
                    <span className="text-[11px] text-stone-500 font-medium">960×960 High-Res JPG</span>
                  </div>

                  <div className="h-56 bg-stone-900/90 rounded-xl flex items-center justify-center p-3 relative group overflow-hidden">
                    <img
                      src="/Woodchucker2.jpg"
                      alt="Woodland Woodchuckers Original Bottle Cap Logo"
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md transition group-hover:scale-105"
                    />
                  </div>

                  <h4 className="font-bold text-stone-900 text-base mt-4">
                    Woodchucker 2 Bottle Cap Emblem
                  </h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    The classic circular bottle cap badge featuring the Blue Note Brewing Co. banners, woodchuck
                    emblem, dual hops, and rich teal background (<code className="font-bold text-woodland-700">#1A607C</code>).
                    Perfect for circular stickers, pint glasses, patches, and app icons.
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-2">
                  <a
                    href="/Woodchucker2.jpg"
                    download="Woodland_Woodchuckers_Heritage_BottleCap.jpg"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-woodland-600 hover:bg-woodland-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JPG</span>
                  </a>
                  <a
                    href="/Woodchucker2.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition"
                    title="Open full resolution"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: EXTRACTED BRAND COLORS */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-woodland-700" />
              <h3 className="font-display font-bold text-lg text-stone-900 uppercase tracking-wide">
                Extracted Color Palette
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {brandColors.map((c) => (
                <div
                  key={c.hex}
                  onClick={() => copyToClipboard(c.hex)}
                  className="group relative cursor-pointer border border-stone-200 hover:border-stone-400 rounded-xl p-3 bg-white shadow-2xs hover:shadow-sm transition"
                >
                  <div
                    className={`h-20 w-full rounded-lg mb-2.5 flex items-end justify-end p-2 transition ${
                      c.border ? 'border border-stone-300' : ''
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded backdrop-blur-xs ${
                        c.textDark ? 'text-stone-900 bg-white/70' : 'text-white bg-black/40'
                      }`}
                    >
                      {c.hex}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-stone-900 leading-tight">{c.name}</h5>
                      <span className="text-[10px] text-stone-500 font-medium block">{c.role}</span>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-stone-400 group-hover:text-stone-700 transition"
                      title="Copy hex code"
                    >
                      {copiedHex === c.hex ? (
                        <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-snug">{c.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-right text-[11px] text-stone-500 mt-2">
              Tip: Click any swatch card to copy its HEX code to your clipboard.
            </p>
          </div>

          {/* SECTION 3: TYPOGRAPHY */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-5 h-5 text-woodland-700" />
              <h3 className="font-display font-bold text-lg text-stone-900 uppercase tracking-wide">
                Typography & Font System
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-woodland-100 text-woodland-900 px-2 py-0.5 rounded">
                  Display / Arched Headers
                </span>
                <h4 className="font-display font-bold text-2xl text-stone-900 mt-2 uppercase tracking-wide">
                  Oswald
                </h4>
                <p className="text-xs text-stone-600 mt-1">
                  Condensed athletic uppercase styling extracted directly from the vintage brewery bottle cap and
                  2026 header arches.
                </p>
                <div className="mt-3 font-display font-extrabold text-sm uppercase tracking-wider text-woodland-700">
                  WOODLAND WOODCHUCKERS RUN CLUB
                </div>
              </div>

              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Sport / Run Crew Script
                </span>
                <h4 className="font-sport font-black text-2xl text-stone-900 mt-2">
                  Outfit
                </h4>
                <p className="text-xs text-stone-600 mt-1">
                  Dynamic, energetic geometric styling matching the punchy &quot;Run Crew&quot; lettering and
                  runner statistics.
                </p>
                <div className="mt-3 font-sport font-black text-base text-amber-600 tracking-tight">
                  Woodland Run Club • 100% Free
                </div>
              </div>

              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-200 text-stone-800 px-2 py-0.5 rounded">
                  Body & Interface
                </span>
                <h4 className="font-sans font-bold text-xl text-stone-900 mt-2">
                  Plus Jakarta Sans
                </h4>
                <p className="text-xs text-stone-600 mt-1">
                  Ultra-clean, modern geometric sans designed for crisp legibility across route maps, mileage
                  leaderboards, and check-ins.
                </p>
                <div className="mt-3 font-sans text-xs text-stone-700 font-medium leading-relaxed">
                  Pounding trails & pavement — one burrow at a time!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-500">
            Assets hosted locally in <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">/public</code> for offline PWA access.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
