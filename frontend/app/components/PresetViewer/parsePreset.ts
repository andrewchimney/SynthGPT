import {
  RawVitalPreset,
  ParsedPreset,
  OscillatorInfo,
  EnvelopeInfo,
  FilterInfo,
  LFOInfo,
  ModulationRoute,
  EffectInfo,
  MacroInfo,
  VelocityMapping,
} from './types';

const SPECTRAL_MORPH_TYPES: Record<number, string> = {
  0: 'None',
  1: 'Vocode',
  2: 'Form Scale',
  3: 'Harmonic Stretch',
  4: 'Inharmonic Stretch',
  5: 'Smear',
  6: 'Random Amplitudes',
  7: 'Low Pass',
  8: 'High Pass',
  9: 'Phase Disperse',
  10: 'Shepard Tone',
  11: 'Spectral Time Skew',
};

const FILTER_MODELS: Record<number, string> = {
  0: 'Analog (12dB)',
  1: 'Analog (24dB)',
  2: 'Dirty (12dB)',
  3: 'Dirty (24dB)',
  4: 'Ladder (12dB)',
  5: 'Ladder (24dB)',
  6: 'Phaser',
  7: 'Formant',
  8: 'Comb (Pos)',
  9: 'Comb (Neg)',
};

const DESTINATIONS: Record<number, string> = {
  0: 'Filter 1',
  1: 'Filter 2',
  2: 'Filter 1 + 2',
  3: 'Direct Out',
};

function getNum(settings: Record<string, unknown>, key: string, defaultVal = 0): number {
  const val = settings[key];
  return typeof val === 'number' ? val : defaultVal;
}

function parseOscillators(settings: Record<string, unknown>, wavetables?: Array<{ name: string }>): OscillatorInfo[] {
  const oscillators: OscillatorInfo[] = [];

  for (let i = 1; i <= 3; i++) {
    const prefix = `osc_${i}_`;
    const enabled = getNum(settings, `${prefix}on`) === 1;

    oscillators.push({
      id: i,
      enabled,
      wavetableName: wavetables?.[i - 1]?.name || 'Init',
      level: Math.round(getNum(settings, `${prefix}level`) * 100),
      transpose: getNum(settings, `${prefix}transpose`),
      spectralMorphType: SPECTRAL_MORPH_TYPES[getNum(settings, `${prefix}spectral_morph_type`)] || 'None',
      spectralMorphAmount: Math.round(getNum(settings, `${prefix}spectral_morph_amount`) * 100),
      unisonVoices: getNum(settings, `${prefix}unison_voices`, 1),
      unisonDetune: getNum(settings, `${prefix}unison_detune`),
      stereoSpread: Math.round(getNum(settings, `${prefix}stereo_spread`) * 100),
      destination: DESTINATIONS[getNum(settings, `${prefix}destination`)] || 'Filter 1',
    });
  }

  return oscillators;
}

function parseEnvelopes(settings: Record<string, unknown>): EnvelopeInfo[] {
  const envelopes: EnvelopeInfo[] = [];

  for (let i = 1; i <= 6; i++) {
    const prefix = `env_${i}_`;
    const attack = getNum(settings, `${prefix}attack`);
    const decay = getNum(settings, `${prefix}decay`);
    const sustain = getNum(settings, `${prefix}sustain`);
    const release = getNum(settings, `${prefix}release`);

    // Determine character based on ADSR values
    let character = 'Custom';
    if (attack < 0.05 && decay < 0.3 && sustain < 0.3) {
      character = 'Pluck';
    } else if (attack > 0.5 && sustain > 0.5) {
      character = 'Pad';
    } else if (attack < 0.1 && sustain > 0.7) {
      character = 'Organ';
    } else if (attack < 0.1 && decay < 0.5 && sustain < 0.5) {
      character = 'Stab';
    } else if (sustain > 0.9) {
      character = 'Gate';
    }

    envelopes.push({
      id: i,
      attack: Math.round(attack * 1000) / 1000,
      decay: Math.round(decay * 1000) / 1000,
      sustain: Math.round(sustain * 100),
      release: Math.round(release * 1000) / 1000,
      character,
    });
  }

  return envelopes;
}

function parseFilters(settings: Record<string, unknown>): FilterInfo[] {
  const filters: FilterInfo[] = [];

  const filterIds = ['filter_1_', 'filter_2_', 'filter_fx_'];
  const filterNames = [1, 2, 3]; // FX filter as 3

  filterIds.forEach((prefix, index) => {
    filters.push({
      id: filterNames[index],
      enabled: getNum(settings, `${prefix}on`) === 1,
      model: FILTER_MODELS[getNum(settings, `${prefix}model`)] || 'Analog',
      cutoff: Math.round(getNum(settings, `${prefix}cutoff`)),
      resonance: Math.round(getNum(settings, `${prefix}resonance`) * 100),
      keytrack: Math.round(getNum(settings, `${prefix}keytrack`) * 100),
      drive: Math.round(getNum(settings, `${prefix}drive`) * 100),
    });
  });

  return filters;
}

function parseLFOs(settings: Record<string, unknown>, lfoShapes?: Array<{ name: string }>): LFOInfo[] {
  const lfos: LFOInfo[] = [];

  for (let i = 1; i <= 8; i++) {
    const prefix = `lfo_${i}_`;
    lfos.push({
      id: i,
      frequency: Math.round(getNum(settings, `${prefix}frequency`) * 100) / 100,
      sync: getNum(settings, `${prefix}sync`) === 1,
      stereoOffset: Math.round(getNum(settings, `${prefix}stereo`) * 100),
      shape: lfoShapes?.[i - 1]?.name || 'Triangle',
      delayTime: getNum(settings, `${prefix}delay_time`),
    });
  }

  return lfos;
}

function parseModulations(settings: Record<string, unknown>): ModulationRoute[] {
  const modulations: ModulationRoute[] = [];
  const rawMods = settings.modulations as Array<{ source: string; destination: string }> | undefined;

  if (!rawMods) return modulations;

  rawMods.forEach((mod, index) => {
    if (mod.source && mod.destination) {
      const amount = getNum(settings, `modulation_${index + 1}_amount`);
      const bipolar = getNum(settings, `modulation_${index + 1}_bipolar`) === 1;

      modulations.push({
        source: mod.source.replace(/_/g, ' '),
        destination: mod.destination.replace(/_/g, ' '),
        amount: Math.round(amount * 100),
        bipolar,
      });
    }
  });

  return modulations.filter(m => m.amount !== 0);
}

function parseEffects(settings: Record<string, unknown>): EffectInfo[] {
  const effects: EffectInfo[] = [];

  // Reverb
  effects.push({
    name: 'Reverb',
    enabled: getNum(settings, 'reverb_on') === 1,
    settings: {
      dryWet: Math.round(getNum(settings, 'reverb_dry_wet') * 100),
      decay: Math.round(getNum(settings, 'reverb_decay_time') * 100),
      size: Math.round(getNum(settings, 'reverb_size') * 100),
    },
  });

  // Delay
  effects.push({
    name: 'Delay',
    enabled: getNum(settings, 'delay_on') === 1,
    settings: {
      dryWet: Math.round(getNum(settings, 'delay_dry_wet') * 100),
      feedback: Math.round(getNum(settings, 'delay_feedback') * 100),
    },
  });

  // Chorus
  effects.push({
    name: 'Chorus',
    enabled: getNum(settings, 'chorus_on') === 1,
    settings: {
      dryWet: Math.round(getNum(settings, 'chorus_dry_wet') * 100),
      voices: getNum(settings, 'chorus_voices'),
    },
  });

  // Distortion
  effects.push({
    name: 'Distortion',
    enabled: getNum(settings, 'distortion_on') === 1,
    settings: {
      drive: Math.round(getNum(settings, 'distortion_drive') * 100),
      mix: Math.round(getNum(settings, 'distortion_mix') * 100),
    },
  });

  // Phaser
  effects.push({
    name: 'Phaser',
    enabled: getNum(settings, 'phaser_on') === 1,
    settings: {
      dryWet: Math.round(getNum(settings, 'phaser_dry_wet') * 100),
      feedback: Math.round(getNum(settings, 'phaser_feedback') * 100),
    },
  });

  // Flanger
  effects.push({
    name: 'Flanger',
    enabled: getNum(settings, 'flanger_on') === 1,
    settings: {
      dryWet: Math.round(getNum(settings, 'flanger_dry_wet') * 100),
      feedback: Math.round(getNum(settings, 'flanger_feedback') * 100),
    },
  });

  // Compressor
  effects.push({
    name: 'Compressor',
    enabled: getNum(settings, 'compressor_on') === 1,
    settings: {
      mix: Math.round(getNum(settings, 'compressor_mix') * 100),
      attack: Math.round(getNum(settings, 'compressor_attack') * 100),
      release: Math.round(getNum(settings, 'compressor_release') * 100),
    },
  });

  // EQ
  effects.push({
    name: 'EQ',
    enabled: getNum(settings, 'eq_on') === 1,
    settings: {
      lowGain: Math.round(getNum(settings, 'eq_low_gain')),
      bandGain: Math.round(getNum(settings, 'eq_band_gain')),
      highGain: Math.round(getNum(settings, 'eq_high_gain')),
    },
  });

  return effects;
}

function parseMacros(preset: RawVitalPreset): MacroInfo[] {
  const settings = preset.settings;
  const macroNames = [preset.macro1, preset.macro2, preset.macro3, preset.macro4];
  const modulations = settings.modulations as Array<{ source: string; destination: string }> | undefined;

  return macroNames.map((name, index) => {
    const targets: string[] = [];

    // Find modulations that use this macro
    modulations?.forEach((mod) => {
      if (mod.source === `macro_control_${index + 1}` && mod.destination) {
        targets.push(mod.destination.replace(/_/g, ' '));
      }
    });

    return {
      id: index + 1,
      name: name || `Macro ${index + 1}`,
      value: Math.round(getNum(settings, `macro_control_${index + 1}`) * 100),
      targets,
    };
  });
}

function parseVelocityMappings(settings: Record<string, unknown>): VelocityMapping[] {
  const mappings: VelocityMapping[] = [];
  const modulations = settings.modulations as Array<{ source: string; destination: string }> | undefined;

  modulations?.forEach((mod, index) => {
    if (mod.source === 'velocity' && mod.destination) {
      const amount = getNum(settings, `modulation_${index + 1}_amount`);
      if (amount !== 0) {
        mappings.push({
          target: mod.destination.replace(/_/g, ' '),
          amount: Math.round(amount * 100),
        });
      }
    }
  });

  return mappings;
}

function analyzeMusicalRole(preset: ParsedPreset): string {
  const env1 = preset.envelopes[0];
  const activeOscs = preset.oscillators.filter(o => o.enabled);
  const hasSubOsc = activeOscs.some(o => o.transpose <= -12);
  const hasBrightFilter = preset.filters.some(f => f.enabled && f.cutoff > 100);

  if (env1.attack > 0.5 && env1.sustain > 50) {
    return 'Pad / Atmosphere';
  }
  if (env1.attack < 0.05 && env1.decay < 0.3 && env1.sustain < 30) {
    return 'Pluck / Perc';
  }
  if (hasSubOsc && preset.polyphony <= 4) {
    return 'Bass';
  }
  if (hasBrightFilter && env1.attack < 0.1) {
    return 'Lead';
  }
  if (env1.attack < 0.1 && env1.decay < 0.5) {
    return 'Stab / Keys';
  }

  return 'Texture / Experimental';
}

function analyzeStereoWidth(preset: ParsedPreset): string {
  const totalUnison = preset.oscillators.reduce((sum, o) => sum + (o.enabled ? o.unisonVoices : 0), 0);
  const totalSpread = preset.oscillators.reduce((sum, o) => sum + (o.enabled ? o.stereoSpread : 0), 0);
  const lfoStereo = preset.lfos.reduce((sum, l) => sum + Math.abs(l.stereoOffset), 0);

  if (totalUnison > 6 || totalSpread > 200 || lfoStereo > 50) {
    return 'Very Wide';
  }
  if (totalUnison > 3 || totalSpread > 100 || lfoStereo > 20) {
    return 'Wide';
  }
  if (totalSpread > 50 || lfoStereo > 10) {
    return 'Moderate';
  }
  return 'Narrow / Mono';
}

function analyzeBrightness(preset: ParsedPreset): string {
  const enabledFilters = preset.filters.filter(f => f.enabled);
  if (enabledFilters.length === 0) return 'Bright (No Filter)';

  const avgCutoff = enabledFilters.reduce((sum, f) => sum + f.cutoff, 0) / enabledFilters.length;
  const highRes = enabledFilters.some(f => f.resonance > 70);

  if (avgCutoff > 100) return highRes ? 'Bright & Resonant' : 'Bright';
  if (avgCutoff > 60) return highRes ? 'Medium & Resonant' : 'Medium';
  return highRes ? 'Dark & Resonant' : 'Dark';
}

function analyzeMovement(preset: ParsedPreset): string {
  const activeModulations = preset.modulations.length;
  const activeLFOs = preset.lfos.filter(l => 
    preset.modulations.some(m => m.source.includes(`lfo ${l.id}`))
  ).length;

  if (activeModulations > 15 || activeLFOs > 4) return 'Highly Animated';
  if (activeModulations > 8 || activeLFOs > 2) return 'Evolving';
  if (activeModulations > 3 || activeLFOs > 0) return 'Subtle Movement';
  return 'Static';
}

export function parseVitalPreset(raw: RawVitalPreset): ParsedPreset {
  const settings = raw.settings;
  const lfoShapes = settings.lfos as Array<{ name: string }> | undefined;

  const parsed: ParsedPreset = {
    // Metadata
    name: 'Unknown',
    author: raw.author || 'Unknown',
    comments: raw.comments || '',
    style: raw.preset_style || 'Unknown',
    synthVersion: raw.synth_version || 'Unknown',

    // Core Sound
    oscillators: parseOscillators(settings, raw.wavetables),
    envelopes: parseEnvelopes(settings),
    filters: parseFilters(settings),

    // Movement
    lfos: parseLFOs(settings, lfoShapes),
    modulations: parseModulations(settings),

    // Effects
    effects: parseEffects(settings),

    // Performance
    polyphony: getNum(settings, 'polyphony', 8),
    legato: getNum(settings, 'legato') === 1,
    portamentoTime: getNum(settings, 'portamento_time'),
    velocityMappings: parseVelocityMappings(settings),
    macros: parseMacros(raw),

    // Placeholders for analysis
    musicalRole: '',
    stereoWidth: '',
    brightness: '',
    movementLevel: '',
  };

  // Run analysis
  parsed.musicalRole = analyzeMusicalRole(parsed);
  parsed.stereoWidth = analyzeStereoWidth(parsed);
  parsed.brightness = analyzeBrightness(parsed);
  parsed.movementLevel = analyzeMovement(parsed);

  return parsed;
}
