from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import numpy as np
import os


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Supabase client is optional — only initialised when credentials are present
supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter()

import json

class RetrieveRequest(BaseModel):
    query: str
    k: int = 10


@router.post("/api/retrieve")
def retrieve(req: RetrieveRequest, request: Request):
    clap = getattr(request.app.state, "clap", None)
    if clap is None:
        raise HTTPException(
            status_code=503,
            detail="CLAP retrieval model is not available. Use fake presets in the frontend for now.",
        )

    if supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_KEY).",
        )

    emb = clap.get_text_embedding([req.query], use_tensor=False)
    emb = np.asarray(emb, dtype=np.float32)[0]
    # cosine normalize
    emb = emb / (np.linalg.norm(emb) + 1e-9)
    emb_list = emb.flatten().tolist() if hasattr(emb, 'ndim') and emb.ndim > 1 else emb.tolist()

    res = supabase.rpc(
        "match_presets",
        {"query_embedding": emb_list, "match_count": req.k}
    ).execute()

    return {
        "query_received": req.query,
        "k": req.k,
        "results": res.data
    }