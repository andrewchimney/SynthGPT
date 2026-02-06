import os
import sys
import time
from pathlib import Path


import numpy as np
from scipy.io import wavfile
import vita


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent      
BACKEND_DIR = BASE_DIR.parent                  

ROOT = BACKEND_DIR / "data" / "presets" / "Jek's Vital Presets"
OUT_ROOT = BACKEND_DIR / "data" / "previews"

# ROOT = Path("data/presets/Jek's Vital Presets/[Patent Sounds] - Luminance LITE (Vital Soundbank)/Presets")                 # folder to search from
# OUT_ROOT = Path("data/previews") # where wavs go
SAMPLE_RATE = 44100
BPM = 120.0

# Audio preview parameters
PITCH = 48        # C3-ish. Try 36 for sub bass packs.
VELOCITY = 0.8
NOTE_DUR = 1.0    # how long the note is held
RENDER_DUR = 3.0  # total render length

# Safety
SKIP_EXISTING = True
PRINT_EVERY = 25
# --------------------------------------------------------

def safe_wav_write(path: Path, sr: int, audio_stereo: np.ndarray):
    """
    vita returns float audio shaped (2, N). scipy wants (N, channels).
    We'll clip and write float32 WAV.
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    # Ensure shape (2, N)
    if audio_stereo.ndim != 2 or audio_stereo.shape[0] != 2:
        raise ValueError(f"Unexpected audio shape: {audio_stereo.shape}")

    audio = audio_stereo.T  # (N, 2)
    audio = np.clip(audio, -1.0, 1.0).astype(np.float32)
    wavfile.write(str(path), sr, audio)

def main():
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    synth = vita.Synth()
    #synth.set_sample_rate(SAMPLE_RATE)
    synth.set_bpm(BPM)

    
        
    preset_paths = sorted(ROOT.rglob("*.vital"))

    if not preset_paths:
        print("No .vital files found. Check ROOT path.")
        return

    print(f"Found {len(preset_paths)} presets")

    ok = 0
    failed = 0
    start = time.time()

    for i, preset_path in enumerate(preset_paths, 1):
        # Mirror folder structure under OUT_ROOT
        rel = preset_path.relative_to(ROOT)
        out_path = (OUT_ROOT / rel).with_suffix(".wav")

        if SKIP_EXISTING and out_path.exists():
            continue

        try:
            # Load preset
            loaded = synth.load_preset(str(preset_path))
            if not loaded:
                raise RuntimeError("synth.load_preset returned False")

            # Render
            audio = synth.render(PITCH, VELOCITY, NOTE_DUR, RENDER_DUR)

            # Write wav
            safe_wav_write(out_path, SAMPLE_RATE, audio)

            ok += 1

        except Exception as e:
            failed += 1 
            print(f"[FAIL] {preset_path}: {e}")

        if i % PRINT_EVERY == 0:
            elapsed = time.time() - start
            print(f"Progress: {i}/{len(preset_paths)} | rendered={ok} | failed={failed} | {elapsed:.1f}s")

    elapsed = time.time() - start
    print(f"\nDone. rendered={ok}, failed={failed}, elapsed={elapsed:.1f}s")
    print(f"WAVs in: {OUT_ROOT.resolve()}")

if __name__ == "__main__":
    main()