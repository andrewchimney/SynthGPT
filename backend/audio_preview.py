import os
from pathlib import Path
from scipy.io import wavfile
import numpy as np

try:
    import vita
except ImportError:
    raise ImportError(
        "The 'vita' package is required. Install it with: pip install vita"
    )


def generate_audio_preview(
    preset_path: str,
    output_path: str | None = None,
    sample_rate: int = 44100,
    bpm: float = 120.0,
    note_duration: float = 1.0,
    render_duration: float = 3.0,
    pitch: int = 60,  # Middle C (C4)
    velocity: float = 0.8,  # 0.0 to 1.0
) -> str:
    
    # Validate preset path
    preset_path = Path(preset_path)
    if not preset_path.exists():
        raise FileNotFoundError(f"Preset file not found: {preset_path}")

    if not preset_path.suffix.lower() == ".vital":
        raise ValueError(f"Expected .vital file, got: {preset_path.suffix}")

    # Determine output path
    if output_path is None:
        output_path = preset_path.with_suffix(".wav")
    else:
        output_path = Path(output_path)

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize the synthesizer
    synth = vita.Synth()
    synth.set_bpm(bpm)

    # Load the preset
    if not synth.load_preset(str(preset_path)):
        raise ValueError(f"Failed to load preset: {preset_path}")

    # Render audio to numpy array (shape: 2, NUM_SAMPLES for stereo)
    audio = synth.render(pitch, velocity, note_duration, render_duration)

    # Normalize audio to prevent clipping
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val * 0.95  # Leave some headroom

    # Convert to int16 for WAV file
    audio_int16 = (audio * 32767).astype(np.int16)

    # Write the WAV file (transpose because scipy expects (NUM_SAMPLES, 2))
    wavfile.write(str(output_path), sample_rate, audio_int16.T)

    return str(output_path)


def generate_audio_preview_from_json(
    json_content: str,
    output_path: str,
    sample_rate: int = 44100,
    bpm: float = 120.0,
    note_duration: float = 1.0,
    render_duration: float = 3.0,
    pitch: int = 60,
    velocity: float = 0.8,
) -> str:
    
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize the synthesizer
    synth = vita.Synth()
    synth.set_bpm(bpm)

    # Load preset from JSON
    if not synth.load_json(json_content):
        raise ValueError("Failed to load preset from JSON content")

    # Render audio
    audio = synth.render(pitch, velocity, note_duration, render_duration)

    # Normalize audio
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = audio / max_val * 0.95

    # Convert to int16 and write WAV
    audio_int16 = (audio * 32767).astype(np.int16)
    wavfile.write(str(output_path), sample_rate, audio_int16.T)

    return str(output_path)


def generate_preview_multiple_notes(
    preset_path: str,
    output_path: str | None = None,
    sample_rate: int = 44100,
    bpm: float = 120.0,
    notes: list[tuple[int, float, float, float]] | None = None,
) -> str:

    preset_path = Path(preset_path)
    if not preset_path.exists():
        raise FileNotFoundError(f"Preset file not found: {preset_path}")

    if output_path is None:
        output_path = preset_path.with_name(preset_path.stem + "_chord.wav")
    else:
        output_path = Path(output_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Default: C major chord
    if notes is None:
        notes = [
            (60, 0.7, 0.0, 2.0),  # C4
            (64, 0.7, 0.0, 2.0),  # E4
            (67, 0.7, 0.0, 2.0),  # G4
        ]

    # Calculate total duration needed
    total_duration = max(start + dur for _, _, start, dur in notes) + 1.0

    # Initialize synthesizer
    synth = vita.Synth()
    synth.set_bpm(bpm)

    if not synth.load_preset(str(preset_path)):
        raise ValueError(f"Failed to load preset: {preset_path}")

    # Render each note and mix
    total_samples = int(total_duration * sample_rate)
    mixed_audio = np.zeros((2, total_samples), dtype=np.float64)

    for pitch, velocity, start_time, duration in notes:
        note_audio = synth.render(pitch, velocity, duration, duration + 0.5)
        start_sample = int(start_time * sample_rate)
        end_sample = start_sample + note_audio.shape[1]

        if end_sample > total_samples:
            end_sample = total_samples
            note_audio = note_audio[:, : end_sample - start_sample]

        mixed_audio[:, start_sample:end_sample] += note_audio

    # Normalize
    max_val = np.max(np.abs(mixed_audio))
    if max_val > 0:
        mixed_audio = mixed_audio / max_val * 0.95

    # Convert and write
    audio_int16 = (mixed_audio * 32767).astype(np.int16)
    wavfile.write(str(output_path), sample_rate, audio_int16.T)

    return str(output_path)


# Example usage and testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python audio_preview.py <preset.vital> [output.wav]")
        print("\nExample:")
        print("  python audio_preview.py my_preset.vital")
        print("  python audio_preview.py my_preset.vital output/preview.wav")
        sys.exit(1)

    preset_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        result = generate_audio_preview(preset_file, output_file)
        print(f"Audio preview generated: {result}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
