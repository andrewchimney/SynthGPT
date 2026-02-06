import numpy as np
import laion_clap
import glob
from pathlib import Path

def cosine_sim(a, b):
    a = a / (np.linalg.norm(a) + 1e-9)
    b = b / (np.linalg.norm(b) + 1e-9)
    return float(np.dot(a, b))

# 1) load model
model = laion_clap.CLAP_Module(enable_fusion=False)
model.load_ckpt()

# 2) your audio previews

BASE_DIR = Path(__file__).resolve().parent      # backend/scripts
BACKEND_DIR = BASE_DIR.parent                  # backend

PREVIEWS_DIR = BACKEND_DIR / "data" / "previews"

audio_files = list(PREVIEWS_DIR.rglob("*.wav"))

print(f"Loaded {len(audio_files)} audio files from {PREVIEWS_DIR}")
print(f"Loaded {len(audio_files)} audio files")

# 3) embed audio (shape: [2, D])
# audio_embeds = model.get_audio_embedding_from_filelist(x=audio_files, use_tensor=False)

# print(audio_embeds.shape)
INDEX_DIR = BACKEND_DIR / "data" / "index"
INDEX_DIR.mkdir(parents=True, exist_ok=True)

BATCH = 64
embeds_list = []
paths_list = []

for i in range(0, len(audio_files), BATCH):
    batch = audio_files[i:i+BATCH]
    try:
        emb = model.get_audio_embedding_from_filelist(x=batch, use_tensor=False)
        embeds_list.append(emb)
        paths_list.extend([str(p) for p in batch])
        print(f"Embedded {min(i+BATCH, len(audio_files))}/{len(audio_files)}")
    except Exception as e:
        print(f"[FAIL batch {i}-{i+len(batch)}] {e}")

audio_embeds = np.vstack(embeds_list)
print("Final embeds:", audio_embeds.shape)
print("Final paths:", len(paths_list))

# 4) query text
query = "jazzy chords with a warm vibe"
text_embed = model.get_text_embedding([query], use_tensor=False)[0]

# 5) score & pick best (IMPORTANT: use paths_list length)
scores = [cosine_sim(text_embed, audio_embeds[i]) for i in range(len(paths_list))]
best_i = int(np.argmax(scores))

print("Query:", query)
print(f"Best match: {paths_list[best_i]}  (score = {scores[best_i]:.4f})")

# Save for reuse
np.save(INDEX_DIR / "audio_embeddings.npy", audio_embeds)

with open(INDEX_DIR / "audio_paths.txt", "w") as f:
    f.write("\n".join(paths_list))