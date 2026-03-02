import os
import io
import time
import uuid
from pathlib import Path

import numpy as np
from scipy.io import wavfile
import vita
import laion_clap

from supabase import create_client
from dotenv import load_dotenv

# -----------------------
# ENV + SUPABASE
# -----------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

PRESETS_BUCKET = "presets"
PREVIEWS_BUCKET = "previews"

PRESETS_DIR = REPO_ROOT / "backend" / "data" / "presets"

# Stable namespace for uuid5
NAMESPACE = uuid.NAMESPACE_URL

# -----------------------
# RENDER CONFIG
# -----------------------

SAMPLE_RATE = 44100
BPM = 120.0

PITCH = 48
VELOCITY = 0.8
NOTE_DUR = 1.0
RENDER_DUR = 3.0

# -----------------------
# CLAP CONFIG
# -----------------------
# NOTE: this loads a big model; do it once.
CLAP_BATCH = int(os.getenv("CLAP_BATCH", "32"))

# -----------------------
# HELPERS
# -----------------------

def stable_id_for(vital_path: Path) -> str:
    rel = vital_path.relative_to(PRESETS_DIR).as_posix()
    return str(uuid.uuid5(NAMESPACE, rel))


def upload_bytes(bucket: str, key: str, data: bytes, content_type: str):
    supabase.storage.from_(bucket).upload(
        path=key,
        file=data,
        file_options={
            "content-type": content_type,
            "upsert": "true",
        },
    )


def upsert_preset_row(
    preset_id: str,
    title: str,
    preset_key: str,
    preview_key: str,
    embedding: list[float],
):
    row = {
        "id": preset_id,
        # If your schema requires this, keep it. If not, you can remove it.
        "supabase_key": preset_key,
        "title": title,
        "visibility": "public",
        "preset_object_key": preset_key,
        "preview_object_key": preview_key,
        "source": "seed",
        # pgvector column (vector(512)) should accept list[float] in most setups
        "embedding": embedding,
    }
    supabase.table("presets").upsert(row).execute()


def render_preview_bytes(synth: vita.Synth, preset_path: Path) -> bytes:
    loaded = synth.load_preset(str(preset_path))
    if not loaded:
        raise RuntimeError("Failed to load preset (synth.load_preset returned False)")

    audio = synth.render(PITCH, VELOCITY, NOTE_DUR, RENDER_DUR)

    if audio.ndim != 2 or audio.shape[0] != 2:
        raise ValueError(f"Unexpected audio shape {audio.shape} (expected (2, N))")

    audio = np.clip(audio.T, -1.0, 1.0).astype(np.float32)  # (N, 2)

    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio)
    buf.seek(0)
    return buf.read()


def embed_wav_bytes_with_clap(model: laion_clap.CLAP_Module, wav_bytes: bytes) -> np.ndarray:
    """
    laion_clap's convenient API expects file paths. We write to a temp file,
    embed it, then delete it.
    Returns a float32 vector of shape (512,).
    """
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
        f.write(wav_bytes)
        f.flush()
        emb = model.get_audio_embedding_from_filelist(x=[f.name], use_tensor=False)
        emb = np.asarray(emb, dtype=np.float32)[0]  # (512,)

    # cosine normalize (matches your retrieve code expectation)
    emb = emb / (np.linalg.norm(emb) + 1e-9)
    return emb


# -----------------------
# MAIN
# -----------------------

def main():
    if not PRESETS_DIR.exists():
        raise RuntimeError(f"PRESETS_DIR not found: {PRESETS_DIR}")

    vital_files = sorted(PRESETS_DIR.rglob("*.vital"))
    print(f"Found {len(vital_files)} presets under {PRESETS_DIR}")

    # Init synth once
    synth = vita.Synth()
    try:
        synth.set_sample_rate(SAMPLE_RATE)
    except Exception:
        pass
    synth.set_bpm(BPM)

    # Init CLAP once
    clap = laion_clap.CLAP_Module(enable_fusion=False)
    clap.load_ckpt()

    ok = 0
    failed = 0
    start = time.time()

    for idx, vital_path in enumerate(vital_files, 1):
        try:
            preset_id = stable_id_for(vital_path)
            title = vital_path.stem

            preset_key = f"{preset_id}.vital"
            preview_key = f"{preset_id}.wav"

            # 1) Render preview wav bytes
            wav_bytes = render_preview_bytes(synth, vital_path)

            # 2) Embed audio (512-d, normalized)
            emb = embed_wav_bytes_with_clap(clap, wav_bytes)
            emb_list = emb.tolist()

            # 3) Upload .vital
            upload_bytes(
                PRESETS_BUCKET,
                preset_key,
                vital_path.read_bytes(),
                "application/octet-stream",
            )

            # 4) Upload preview .wav
            upload_bytes(
                PREVIEWS_BUCKET,
                preview_key,
                wav_bytes,
                "audio/wav",
            )

            # 5) Upsert DB row (includes embedding)
            upsert_preset_row(
                preset_id=preset_id,
                title=title,
                preset_key=preset_key,
                preview_key=preview_key,
                embedding=emb_list,
            )

            ok += 1
            if idx % 25 == 0:
                print(f"Progress: {idx}/{len(vital_files)} ok={ok} failed={failed} elapsed={(time.time()-start):.1f}s")
            else:
                print(f"[OK] {title}")

        except Exception as e:
            failed += 1
            print(f"[FAIL] {vital_path.name}: {e}")

    print(f"\nDone. ok={ok}, failed={failed}, elapsed={(time.time()-start):.1f}s")


if __name__ == "__main__":
    main()