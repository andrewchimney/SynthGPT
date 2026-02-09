// Types for parsed Vital preset data

export interface OscillatorInfo {
  id: number;
  enabled: boolean;
  wavetableName: string;
  level: number;
  transpose: number;
  spectralMorphType: string;
  spectralMorphAmount: number;
  unisonVoices: number;
  unisonDetune: number;
  stereoSpread: number;
  destination: string;
}

export interface EnvelopeInfo {
  id: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  character: string;
}

export interface FilterInfo {
  id: number;
  enabled: boolean;
  model: string;
  cutoff: number;
  resonance: number;
  keytrack: number;
  drive: number;
}

export interface LFOInfo {
  id: number;
  frequency: number;
  sync: boolean;
  stereoOffset: number;
  shape: string;
  delayTime: number;
}

export interface ModulationRoute {
  source: string;
  destination: string;
  amount: number;
  bipolar: boolean;
}

export interface EffectInfo {
  name: string;
  enabled: boolean;
  settings: Record<string, number>;
}

export interface MacroInfo {
  id: number;
  name: string;
  value: number;
  targets: string[];
}

export interface VelocityMapping {
  target: string;
  amount: number;
}

export interface ParsedPreset {
  // Metadata
  name: string;
  author: string;
  comments: string;
  style: string;
  category?: string; // bass, lead, pad, pluck, keys, fx, etc.
  synthVersion: string;

  // Core Sound
  oscillators: OscillatorInfo[];
  envelopes: EnvelopeInfo[];
  filters: FilterInfo[];

  // Movement
  lfos: LFOInfo[];
  modulations: ModulationRoute[];

  // Effects
  effects: EffectInfo[];

  // Performance
  polyphony: number;
  legato: boolean;
  portamentoTime: number;
  velocityMappings: VelocityMapping[];
  macros: MacroInfo[];

  // Analysis
  musicalRole: string;
  stereoWidth: string;
  brightness: string;
  movementLevel: string;
}

// Raw Vital preset structure (partial)
export interface RawVitalPreset {
  author?: string;
  comments?: string;
  preset_style?: string;
  synth_version?: string;
  macro1?: string;
  macro2?: string;
  macro3?: string;
  macro4?: string;
  settings: Record<string, number | string | unknown[]>;
  wavetables?: Array<{
    name: string;
    author?: string;
    groups?: unknown[];
  }>;
}
