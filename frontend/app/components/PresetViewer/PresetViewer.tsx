'use client';

import { useMemo } from 'react';
import { ParsedPreset, EnvelopeInfo, OscillatorInfo } from './types';

// Decode base64 wave data to float array
function decodeWaveData(base64: string): Float32Array | null {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Float32Array(bytes.buffer);
  } catch {
    return null;
  }
}

// Mini waveform visualization component
function WaveformMini({ waveData, enabled }: { waveData?: string; enabled: boolean }) {
  const pathData = useMemo(() => {
    if (!waveData) return null;
    
    const samples = decodeWaveData(waveData);
    if (!samples || samples.length === 0) return null;
    
    // Downsample for display - take every Nth sample
    const targetPoints = 64;
    const step = Math.max(1, Math.floor(samples.length / targetPoints));
    const points: number[] = [];
    
    for (let i = 0; i < samples.length; i += step) {
      points.push(samples[i]);
    }
    
    // Build SVG path
    const w = 60;
    const h = 24;
    const padding = 2;
    const usableWidth = w - padding * 2;
    const usableHeight = h - padding * 2;
    
    let path = '';
    for (let i = 0; i < points.length; i++) {
      const x = padding + (i / (points.length - 1)) * usableWidth;
      const y = padding + ((1 - points[i]) / 2) * usableHeight; // Map -1..1 to height
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    
    return path;
  }, [waveData]);
  
  if (!pathData) {
    // Show a simple sine wave placeholder if no data
    return (
      <svg width={60} height={24} className="block">
        <path 
          d="M 2 12 Q 17 2, 32 12 Q 47 22, 58 12" 
          fill="none" 
          stroke={enabled ? "#6b7280" : "#3f3f46"} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  
  return (
    <svg width={60} height={24} className="block">
      <path 
        d={pathData} 
        fill="none" 
        stroke={enabled ? "#2dd4bf" : "#3f3f46"} 
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Oscillator card with waveform
function OscillatorCard({ osc }: { osc: OscillatorInfo }) {
  return (
    <div 
      className={`flex flex-col p-2.5 rounded-lg border transition-all ${
        osc.enabled 
          ? 'bg-zinc-800/80 border-zinc-700' 
          : 'bg-zinc-800/30 border-zinc-800 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-medium ${osc.enabled ? 'text-zinc-400' : 'text-zinc-600'}`}>
          OSC {osc.id}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${osc.enabled ? 'bg-teal-400' : 'bg-zinc-600'}`} />
      </div>
      
      <WaveformMini 
        waveData={osc.wavetable?.waveData} 
        enabled={osc.enabled} 
      />
      
      <span className={`mt-2 text-[11px] truncate ${
        osc.enabled ? 'text-zinc-200' : 'text-zinc-500'
      }`} title={osc.wavetableName}>
        {osc.wavetableName}
      </span>
      
      {osc.wavetable?.componentType && osc.wavetable.componentType !== 'Wave Source' && (
        <span className="text-[9px] text-zinc-500 truncate">
          {osc.wavetable.componentType.replace('Audio File Source', 'Sample').replace('Wave Warp', '+Warp')}
        </span>
      )}
    </div>
  );
}

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
  compact?: boolean; // For embedding in posts
}

export default function PresetViewer({ preset, presetName, category, uploadDate, compact = false }: PresetViewerProps) {
  const activeEffects = preset.effects.filter(e => e.enabled);
  
  const cat = category?.toLowerCase() || 'other';
  const categoryStyle = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;

  return (
    <div className={`w-full bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden font-sans ${compact ? '' : 'max-w-lg'}`}>
      {/* Header - Title, Category, Date */}
      <div className={`border-b border-zinc-800 ${compact ? 'p-4' : 'p-5 pr-14'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-white truncate ${compact ? 'text-base' : 'text-lg'}`}>
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
      <div className={`space-y-4 ${compact ? 'p-4' : 'p-5'}`}>
        {/* Oscillators with Waveforms */}
        <div>
          <span className="text-xs text-zinc-500 mb-2 block">Oscillators</span>
          <div className="grid grid-cols-3 gap-2">
            {preset.oscillators.map((osc) => (
              <OscillatorCard key={osc.id} osc={osc} />
            ))}
          </div>
        </div>

        {/* Envelopes - Mini visual */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16 shrink-0">Envelopes</span>
          <div className="flex gap-3 flex-wrap">
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

        {/* Effects - Simple chips */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 w-16 shrink-0">Effects</span>
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
          <span className="text-xs text-zinc-500 w-16 shrink-0">Macros</span>
          <div className="flex flex-wrap gap-1.5">
            {preset.macros.filter(m => m.name).map((macro) => (
              <Chip key={macro.id}>{macro.name}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {preset.comments && (
        <div className={`border-t border-zinc-800 ${compact ? 'px-4 py-2' : 'px-5 py-3'}`}>
          <p className="text-xs text-zinc-500 italic line-clamp-2">{preset.comments}</p>
        </div>
      )}
    </div>
  );
}
