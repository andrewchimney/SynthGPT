'use client';

import { ParsedPreset, EnvelopeInfo, LFOInfo, FilterInfo, OscillatorInfo } from './types';

/**
 * PresetModificator - Advanced preset editing interface
 * 
 * This component provides a detailed, interactive view of all preset parameters
 * for future implementation of preset modification features.
 * 
 * TODO: Add state management for parameter changes
 * TODO: Add onChange callbacks for each parameter
 * TODO: Connect to backend for saving modified presets
 */

// ============================================
// VISUAL COMPONENTS
// ============================================

// Visual ADSR Envelope Graph with control points
export function EnvelopeGraph({ 
  envelope, 
  label,
  onAttackChange,
  onDecayChange,
  onSustainChange,
  onReleaseChange,
}: { 
  envelope: EnvelopeInfo; 
  label: string;
  onAttackChange?: (value: number) => void;
  onDecayChange?: (value: number) => void;
  onSustainChange?: (value: number) => void;
  onReleaseChange?: (value: number) => void;
}) {
  const maxTime = 3;
  const width = 200;
  const height = 60;
  const padding = 4;
  
  const attackX = padding + Math.min(envelope.attack / maxTime, 0.3) * (width - padding * 2);
  const decayEnd = attackX + Math.min(envelope.decay / maxTime, 0.25) * (width - padding * 2);
  const sustainWidth = (width - padding * 2) * 0.25;
  const sustainEnd = decayEnd + sustainWidth;
  const releaseEnd = width - padding;
  
  const bottom = height - padding;
  const top = padding;
  const sustainY = top + (1 - envelope.sustain / 100) * (bottom - top);
  
  const path = `
    M ${padding} ${bottom}
    L ${attackX} ${top}
    L ${decayEnd} ${sustainY}
    L ${sustainEnd} ${sustainY}
    L ${releaseEnd} ${bottom}
  `;
  
  const fillPath = `${path} L ${padding} ${bottom} Z`;

  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 mb-1">{label}</span>
      <div className="bg-zinc-900 rounded border border-zinc-700 p-1">
        <svg width={width} height={height} className="block">
          {/* Grid lines */}
          <line x1={padding} y1={bottom} x2={width - padding} y2={bottom} stroke="#3f3f46" strokeWidth="1" />
          <line x1={padding} y1={top} x2={padding} y2={bottom} stroke="#3f3f46" strokeWidth="1" />
          
          {/* Fill */}
          <path d={fillPath} fill="rgba(45, 212, 191, 0.15)" />
          
          {/* Envelope line */}
          <path d={path} fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Control points - these will be draggable in future */}
          <circle cx={attackX} cy={top} r="4" fill="#2dd4bf" className="cursor-pointer hover:fill-white" />
          <circle cx={decayEnd} cy={sustainY} r="4" fill="#2dd4bf" className="cursor-pointer hover:fill-white" />
          <circle cx={sustainEnd} cy={sustainY} r="4" fill="#2dd4bf" className="cursor-pointer hover:fill-white" />
        </svg>
        
        {/* ADSR Values */}
        <div className="flex justify-between text-[9px] text-zinc-500 mt-1 px-1">
          <span>A:{envelope.attack.toFixed(2)}s</span>
          <span>D:{envelope.decay.toFixed(2)}s</span>
          <span>S:{envelope.sustain}%</span>
          <span>R:{envelope.release.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}

// LFO Waveform Visualization
export function LFOWaveform({ 
  lfo, 
  index,
  showStereo = true,
}: { 
  lfo: LFOInfo; 
  index: number;
  showStereo?: boolean;
}) {
  const width = 60;
  const height = 24;
  const mid = height / 2;
  
  let path = '';
  const shape = lfo.shape;
  
  if (shape === 'Triangle') {
    path = `M 0 ${mid} L ${width/4} 2 L ${width/2} ${mid} L ${width*3/4} ${height-2} L ${width} ${mid}`;
  } else if (shape === 'Sine') {
    path = `M 0 ${mid} Q ${width/4} 2 ${width/2} ${mid} Q ${width*3/4} ${height-2} ${width} ${mid}`;
  } else if (shape === 'Square') {
    path = `M 0 ${height-2} L 0 2 L ${width/2} 2 L ${width/2} ${height-2} L ${width} ${height-2} L ${width} 2`;
  } else if (shape === 'Saw') {
    path = `M 0 ${height-2} L ${width/2} 2 L ${width/2} ${height-2} L ${width} 2`;
  } else {
    // Custom/default - jagged
    path = `M 0 ${mid} L ${width/6} 4 L ${width/3} ${mid} L ${width/2} ${height-4} L ${width*2/3} 6 L ${width*5/6} ${mid} L ${width} ${height-6}`;
  }

  return (
    <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-900/80 rounded">
      <span className="text-[8px] text-zinc-500">{index}</span>
      <svg width={width} height={height} className="block">
        <path d={path} fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      </svg>
      {showStereo && lfo.stereoOffset !== 0 && (
        <span className="text-[8px] text-purple-400">{lfo.stereoOffset > 0 ? 'L' : 'R'}</span>
      )}
    </div>
  );
}

// Interactive Knob Component
export function Knob({ 
  value, 
  max = 100, 
  min = 0,
  label, 
  color = 'cyan',
  size = 'md',
  onChange,
}: { 
  value: number; 
  max?: number; 
  min?: number;
  label: string; 
  color?: 'cyan' | 'purple' | 'amber' | 'rose' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: number) => void;
}) {
  const percentage = Math.min((value - min) / (max - min), 1);
  const angle = -135 + percentage * 270;
  
  const colors: Record<string, string> = {
    cyan: '#2dd4bf',
    purple: '#a78bfa',
    amber: '#fbbf24',
    rose: '#fb7185',
    blue: '#60a5fa',
  };

  const sizes = {
    sm: { svg: 28, r: 10, stroke: 3, line: 6, font: '8px' },
    md: { svg: 36, r: 13, stroke: 4, line: 8, font: '9px' },
    lg: { svg: 48, r: 18, stroke: 5, line: 10, font: '10px' },
  };

  const s = sizes[size];
  const center = s.svg / 2;

  return (
    <div className="flex flex-col items-center">
      <svg width={s.svg} height={s.svg} viewBox={`0 0 ${s.svg} ${s.svg}`} className="cursor-pointer">
        {/* Background arc */}
        <circle 
          cx={center} cy={center} r={s.r} 
          fill="none" stroke="#3f3f46" strokeWidth={s.stroke}
          strokeDasharray={`${s.r * 2.95} ${s.r * 1.2}`} 
          strokeDashoffset={-s.r * 0.6} 
          strokeLinecap="round" 
        />
        {/* Value arc */}
        <circle 
          cx={center} cy={center} r={s.r} 
          fill="none" stroke={colors[color]} strokeWidth={s.stroke}
          strokeDasharray={`${percentage * s.r * 2.95} 100`} 
          strokeDashoffset={-s.r * 0.6} 
          strokeLinecap="round" 
        />
        {/* Indicator line */}
        <line 
          x1={center} y1={center} 
          x2={center + s.line * Math.cos((angle - 90) * Math.PI / 180)} 
          y2={center + s.line * Math.sin((angle - 90) * Math.PI / 180)} 
          stroke="#fff" strokeWidth="2" strokeLinecap="round" 
        />
      </svg>
      <span className="text-zinc-500 mt-0.5" style={{ fontSize: s.font }}>{label}</span>
    </div>
  );
}

// Status Indicator with toggle support
export function StatusIndicator({ 
  active, 
  label,
  onClick,
}: { 
  active: boolean; 
  label: string;
  onClick?: () => void;
}) {
  return (
    <div 
      className={`flex items-center gap-1.5 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
        active ? 'bg-emerald-400' : 'bg-zinc-600'
      }`} />
      <span className={`text-[10px] transition-colors ${
        active ? 'text-zinc-300' : 'text-zinc-600'
      }`}>
        {label}
      </span>
    </div>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

// Oscillator Section
export function OscillatorSection({ 
  oscillator,
  onChange,
}: { 
  oscillator: OscillatorInfo;
  onChange?: (changes: Partial<OscillatorInfo>) => void;
}) {
  return (
    <div className={`p-3 rounded-lg border ${
      oscillator.enabled 
        ? 'bg-zinc-800/80 border-zinc-600' 
        : 'bg-zinc-900/50 border-zinc-800 opacity-40'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-500">OSC {oscillator.id}</span>
        <div className={`w-2.5 h-2.5 rounded-full cursor-pointer ${
          oscillator.enabled ? 'bg-cyan-400' : 'bg-zinc-700'
        }`} />
      </div>
      
      <div className="text-xs font-medium text-zinc-200 truncate mb-2">
        {oscillator.wavetableName}
      </div>
      
      {oscillator.enabled && (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Knob value={oscillator.level} label="LVL" color="cyan" size="sm" />
            <div className="flex-1 text-[9px] text-zinc-500 space-y-0.5">
              <div>{oscillator.transpose !== 0 ? `${oscillator.transpose > 0 ? '+' : ''}${oscillator.transpose}st` : '0st'}</div>
              <div>→ {oscillator.destination}</div>
            </div>
          </div>
          
          {oscillator.spectralMorphType !== 'None' && (
            <div className="text-[9px] text-purple-400 mt-1">
              {oscillator.spectralMorphType} @ {oscillator.spectralMorphAmount}%
            </div>
          )}
          
          {oscillator.unisonVoices > 1 && (
            <div className="text-[9px] text-zinc-500 mt-1">
              Unison: {oscillator.unisonVoices}v / {oscillator.unisonDetune}%
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Filter Section
export function FilterSection({ 
  filter,
  onChange,
}: { 
  filter: FilterInfo;
  onChange?: (changes: Partial<FilterInfo>) => void;
}) {
  return (
    <div className={`flex-1 ${!filter.enabled && 'opacity-40'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-2 h-2 rounded-full cursor-pointer ${
          filter.enabled ? 'bg-blue-400' : 'bg-zinc-600'
        }`} />
        <span className="text-[10px] text-zinc-400">F{filter.id}</span>
        <span className="text-[9px] text-zinc-500">{filter.model}</span>
      </div>
      
      {filter.enabled && (
        <div className="flex gap-2">
          <Knob value={filter.cutoff} max={128} label="CUT" color="cyan" size="sm" />
          <Knob value={filter.resonance} label="RES" color="amber" size="sm" />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN MODIFICATOR COMPONENT
// ============================================

interface PresetModificatorProps {
  preset: ParsedPreset;
  presetName?: string;
  onPresetChange?: (preset: ParsedPreset) => void;
}

export default function PresetModificator({ 
  preset, 
  presetName,
  onPresetChange,
}: PresetModificatorProps) {
  const activeEffects = preset.effects.filter(e => e.enabled);
  const activeLFOs = preset.lfos.filter((_, i) => 
    preset.modulations.some(m => m.source.includes(`lfo ${i + 1}`))
  );

  return (
    <div className="w-full max-w-3xl bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-900/40 to-cyan-900/40 border-b border-zinc-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{presetName || 'Preset'}</h2>
            <p className="text-zinc-400 text-xs">by {preset.author} • {preset.style}</p>
          </div>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] rounded border border-emerald-500/30">
              {preset.musicalRole}
            </span>
            <span className="px-2 py-1 bg-zinc-700/50 text-zinc-300 text-[10px] rounded">
              {preset.polyphony}V
            </span>
          </div>
        </div>
        {preset.comments && (
          <p className="mt-2 text-[11px] text-zinc-400 italic">{preset.comments}</p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Oscillators Row */}
        <div className="flex gap-3">
          {preset.oscillators.map((osc) => (
            <div key={osc.id} className="flex-1">
              <OscillatorSection oscillator={osc} />
            </div>
          ))}
        </div>

        {/* Envelopes Row */}
        <div className="flex gap-3">
          <EnvelopeGraph envelope={preset.envelopes[0]} label="ENV 1 (Amp)" />
          <EnvelopeGraph envelope={preset.envelopes[1]} label="ENV 2 (Mod)" />
          {preset.envelopes[2] && (
            <EnvelopeGraph envelope={preset.envelopes[2]} label="ENV 3" />
          )}
        </div>

        {/* Filters + LFOs Row */}
        <div className="flex gap-3">
          {/* Filters */}
          <div className="flex-1 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-[10px] text-zinc-500 mb-2">FILTERS</div>
            <div className="flex gap-4">
              {preset.filters.slice(0, 2).map((filter) => (
                <FilterSection key={filter.id} filter={filter} />
              ))}
            </div>
          </div>

          {/* LFOs */}
          <div className="flex-1 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-[10px] text-zinc-500 mb-2">LFOs ({activeLFOs.length} active)</div>
            <div className="flex flex-wrap gap-2">
              {preset.lfos.slice(0, 4).map((lfo, i) => {
                const isActive = preset.modulations.some(m => m.source.includes(`lfo ${i + 1}`));
                if (!isActive) return null;
                return <LFOWaveform key={i} lfo={lfo} index={i + 1} />;
              })}
            </div>
          </div>
        </div>

        {/* Effects + Macros Row */}
        <div className="flex gap-3">
          {/* Effects */}
          <div className="flex-1 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-[10px] text-zinc-500 mb-2">EFFECTS ({activeEffects.length})</div>
            <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
              {preset.effects.map((fx) => (
                <StatusIndicator key={fx.name} active={fx.enabled} label={fx.name.slice(0, 4)} />
              ))}
            </div>
          </div>

          {/* Macros */}
          <div className="flex-1 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div className="text-[10px] text-zinc-500 mb-2">MACROS</div>
            <div className="grid grid-cols-2 gap-2">
              {preset.macros.map((macro) => (
                <div key={macro.id} className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-[9px] text-purple-300 font-medium">
                    {macro.id}
                  </div>
                  <span className="text-[10px] text-zinc-300 truncate">{macro.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modulation Matrix */}
        {preset.modulations.length > 0 && (
          <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-500 mb-2">
              MODULATION ({preset.modulations.length} routes)
            </div>
            <div className="flex flex-wrap gap-1">
              {preset.modulations.slice(0, 8).map((mod, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-900 rounded text-[8px] cursor-pointer hover:bg-zinc-800"
                >
                  <span className="text-cyan-400">{mod.source.replace(' ', '')}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-400">{mod.destination.split(' ').slice(0, 2).join(' ')}</span>
                  <span className={`${mod.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {mod.amount > 0 ? '+' : ''}{mod.amount}%
                  </span>
                </span>
              ))}
              {preset.modulations.length > 8 && (
                <span className="text-[8px] text-zinc-600 px-1">+{preset.modulations.length - 8} more</span>
              )}
            </div>
          </div>
        )}

        {/* Footer Stats */}
        <div className="flex items-center justify-between text-[9px] text-zinc-600 pt-2 border-t border-zinc-800">
          <div className="flex gap-3">
            <span>{preset.brightness}</span>
            <span>{preset.stereoWidth}</span>
            <span>{preset.movementLevel}</span>
          </div>
          <span>Vital v{preset.synthVersion}</span>
        </div>
      </div>
    </div>
  );
}
