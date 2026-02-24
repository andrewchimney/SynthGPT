"""
Vita Converter Microservice
Converts .vital preset files to .wav audio previews using the vita Python package.
Runs as a separate Docker container (linux/amd64) since vita only has x86_64 wheels.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from scipy.io import wavfile
import numpy as np
import vita
import tempfile
import os
import io

app = FastAPI(title="Vita Converter")


@app.get("/health")
def health():
    return {"ok": True, "vita": True}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    """Convert a .vital preset file to a .wav audio preview.
    
    Returns raw WAV bytes with Content-Type: audio/wav
    """
    contents = await file.read()
    
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.TemporaryDirectory() as tmpdir:
        vital_path = os.path.join(tmpdir, "preset.vital")
        wav_path = os.path.join(tmpdir, "output.wav")

        # Write .vital to temp file
        with open(vital_path, "wb") as f:
            f.write(contents)

        try:
            # Initialize Vital synth and load preset
            synth = vita.Synth()
            synth.set_bpm(120.0)

            if not synth.load_preset(vital_path):
                raise HTTPException(status_code=422, detail="Failed to load preset file")

            # Render audio: middle C, ~3 seconds (positional args)
            audio = synth.render(60, 0.8, 1.0, 3.0)

            # Normalize audio to prevent clipping
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 0.95

            # Convert to int16 for WAV
            audio_int16 = (audio * 32767).astype(np.int16)

            # Write WAV to bytes buffer
            buf = io.BytesIO()
            wavfile.write(buf, 44100, audio_int16.T)
            wav_bytes = buf.getvalue()

            return Response(content=wav_bytes, media_type="audio/wav")

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Render failed: {str(e)}")
