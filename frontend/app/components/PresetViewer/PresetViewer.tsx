'use client';

import { ParsedPreset, EnvelopeInfo } from './types';

// Usage: 
// 1. Get the raw preset data (JSON from .vital file or API)
//      Ex: 
            // const response = await fetch('http://localhost:8000/api/presets/123');
            // const rawPreset = await response.json();
            // const file = event.target.files[0];
            // const rawPreset = JSON.parse(await file.text());
// 2. Parse it
//      Ex:
            // import { parseVitalPreset } from '../components/PresetViewer';
            // const parsed = parseVitalPreset(rawPreset);
// 3. Render the component
//      Ex:
            // <PresetViewer 
            // preset={parsed} 
            // presetName="A Night in Kalyan"
            // category="Pad"           // optional
            // uploadDate={new Date()}  // optional
            // />


// Compact ADSR Graph - simplified for readability
function MiniEnvelope({ envelope }: { envelope: EnvelopeInfo }) {
  const w = 80, h = 32, p = 2;
  const maxT = 2;
  const ax = p + Math.min(envelope.attack / maxT, 0.35) * (w - p * 2);
  const dx = ax + Math.min(envelope.decay / maxT, 0.25) * (w - p * 2);
  const sx = dx + (w - p * 2) * 0.2;
  const bot = h - p, top = p;
  const sy = top + (1 - envelope.sustain / 100) * (bot - top);
  const path = `M ${p} ${bot} L ${ax} ${top} L ${dx} ${sy} L ${sx} ${sy} L ${w - p} ${bot}`;

  return (
    <svg width={w} height={h} className="block">
      <path d={`${path} L ${p} ${bot} Z`} fill="rgba(45, 212, 191, 0.1)" />
      <path d={path} fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Simple chip/tag component
function Chip({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium ${
      active ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
    }`}>
      {children}
    </span>
  );
}

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  bass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  lead: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  pad: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  pluck: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  keys: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  fx: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  drums: 'bg-red-500/20 text-red-300 border-red-500/30',
  vocal: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  other: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PresetViewerProps {
  preset: ParsedPreset;
  presetName?: string;
  category?: string;
  uploadDate?: Date;
}

export default function PresetViewer({ preset, presetName, category, uploadDate }: PresetViewerProps) {
  const activeEffects = preset.effects.filter(e => e.enabled);
  const activeLFOCount = preset.lfos.filter((_, i) => 
    preset.modulations.some(m => m.source.includes(`lfo ${i + 1}`))
  ).length;
  
  const cat = category?.toLowerCase() || 'other';
  const categoryStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;

  return (
    <div className="w-full max-w-lg bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden font-sans">
      {/* Header - Title, Category, Date */}
      <div className="p-5 border-b border-zinc-800 pr-14">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {presetName || 'Untitled Preset'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">by {preset.author}</p>
          </div>
          <span className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border ${categoryStyle}`}>
            {category || 'Other'}
          </span>
        </div>
        {uploadDate && (
          <p className="text-xs text-zinc-600 mt-3">Uploaded {formatDate(uploadDate)}</p>
        )}
      </div>

      {/* Compact Info Grid */}
      <div className="p-5 space-y-4">
        {/* Envelopes - Mini visual */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16">Envelopes</span>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded-lg">
              <span className="text-[11px] text-zinc-400">Amp</span>
              <MiniEnvelope envelope={preset.envelopes[0]} />
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded-lg">
              <span className="text-[11px] text-zinc-400">Mod</span>
              <MiniEnvelope envelope={preset.envelopes[1]} />
            </div>
          </div>
        </div>

        {/* LFOs - Just count */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16">LFOs</span>
          <div className="flex gap-1">
            {activeLFOCount > 0 ? (
              <Chip>{activeLFOCount} active</Chip>
            ) : (
              <Chip active={false}>None</Chip>
            )}
          </div>
        </div>

        {/* Effects - Simple chips */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16">Effects</span>
          <div className="flex flex-wrap gap-1.5">
            {activeEffects.length > 0 ? (
              activeEffects.map((fx) => (
                <Chip key={fx.name}>{fx.name}</Chip>
              ))
            ) : (
              <Chip active={false}>None</Chip>
            )}
          </div>
        </div>

        {/* Macros - Simple list */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16">Macros</span>
          <div className="flex flex-wrap gap-1.5">
            {preset.macros.filter(m => m.name).map((macro) => (
              <Chip key={macro.id}>{macro.name}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {preset.comments && (
        <div className="px-5 py-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 italic line-clamp-2">{preset.comments}</p>
        </div>
      )}
    </div>
  );
}
