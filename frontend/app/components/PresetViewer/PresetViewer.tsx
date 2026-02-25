'use client';

import { useMemo } from 'react';
import { ParsedPreset, EnvelopeInfo, OscillatorInfo } from './types';

// Oscillator card with waveform
function OscillatorCard({ osc, compact = false }: { osc: OscillatorInfo; compact?: boolean }) {
  return (
    <div 
      className={`flex flex-col p-4 rounded-lg border transition-all ${
        osc.enabled 
          ? 'bg-zinc-800/80 border-zinc-700' 
          : 'bg-zinc-800/30 border-zinc-800 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium ${osc.enabled ? 'text-zinc-400' : 'text-zinc-600'}`}>
          OSC {osc.id}
        </span>
        <div className={`w-2 h-2 rounded-full ${osc.enabled ? 'bg-teal-400' : 'bg-zinc-600'}`} />
      </div>
      
      <div className="w-full mb-3">
        <WaveformMini 
          waveData={osc.wavetable?.waveData} 
          enabled={osc.enabled}
          compact={compact}
        />
      </div>
      
      <span className={`text-xs truncate ${
        osc.enabled ? 'text-zinc-200' : 'text-zinc-500'
      }`} title={osc.wavetableName}>
        {osc.wavetableName}
      </span>
      
      {osc.wavetable?.componentType && osc.wavetable.componentType !== 'Wave Source' && (
        <span className="text-[10px] text-zinc-500 truncate mt-1">
          {osc.wavetable.componentType.replace('Audio File Source', 'Sample').replace('Wave Warp', '+Warp')}
        </span>
      )}
    </div>
  );
}

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
function WaveformMini({ waveData, enabled, compact = false }: { waveData?: string; enabled: boolean; compact?: boolean }) {
  // Use viewBox for responsive scaling
  const w = 100;
  const h = 40;
  
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
  }, [waveData, w, h]);
  
  if (!pathData) {
    // Show a simple sine wave placeholder if no data
    const midY = h / 2;
    const q1x = w * 0.28, q2x = w * 0.78;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-10" preserveAspectRatio="xMidYMid meet">
        <path 
          d={`M 2 ${midY} Q ${q1x} 2, ${w/2} ${midY} Q ${q2x} ${h-2}, ${w-2} ${midY}`}
          fill="none" 
          stroke={enabled ? "#6b7280" : "#3f3f46"} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full h-10" preserveAspectRatio="xMidYMid meet">
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

// Compact ADSR Graph - simplified for readability
function MiniEnvelope({ envelope, compact = false }: { envelope: EnvelopeInfo; compact?: boolean }) {
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
    <div className="w-full bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden font-sans">
      {/* Header - Title, Category, Date */}
      <div className={`border-b border-zinc-800 ${compact ? 'px-5 py-4' : 'p-5 pr-14'}`}>
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
      <div className={compact ? 'p-5 space-y-4' : 'p-5 space-y-4'}>
        {/* Oscillators with Waveforms */}
        <div>
          <span className="text-xs text-zinc-500 mb-3 block">Oscillators</span>
          <div className="grid grid-cols-3 gap-3">
            {preset.oscillators.map((osc) => (
              <OscillatorCard key={osc.id} osc={osc} compact={compact} />
            ))}
          </div>
        </div>

        {/* Envelopes - Mini visual */}
        <div className={compact ? 'flex flex-wrap items-start gap-2' : 'flex items-center gap-4'}>
          <span className={`text-xs text-zinc-500 ${compact ? 'w-full mb-1' : 'w-16 shrink-0'}`}>Envelopes</span>
          <div className="flex gap-2 flex-wrap flex-1">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded-lg">
              <span className="text-[11px] text-zinc-400">Amp</span>
              <MiniEnvelope envelope={preset.envelopes[0]} compact={compact} />
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded-lg">
              <span className="text-[11px] text-zinc-400">Mod</span>
              <MiniEnvelope envelope={preset.envelopes[1]} compact={compact} />
            </div>
          </div>
        </div>

        {/* Effects - Simple chips */}
        <div className={compact ? 'flex flex-wrap items-start gap-2' : 'flex items-center gap-4'}>
          <span className={`text-xs text-zinc-500 ${compact ? 'w-full mb-1' : 'w-16 shrink-0'}`}>Effects</span>
          <div className="flex flex-wrap gap-1.5 flex-1">
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
        <div className={compact ? 'flex flex-wrap items-start gap-2' : 'flex items-center gap-4'}>
          <span className={`text-xs text-zinc-500 ${compact ? 'w-full mb-1' : 'w-16 shrink-0'}`}>Macros</span>
          <div className="flex flex-wrap gap-1.5 flex-1">
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
