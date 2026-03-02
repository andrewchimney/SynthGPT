from fastapi import APIRouter, Request
from pydantic import BaseModel
import numpy as np
from supabase import create_client
import os




SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter()

import json

class RetrieveRequest(BaseModel):
    query: str
    k: int = 10
    


@router.post("/api/retrieve")
def retrieve(req: RetrieveRequest, request: Request):
    
    
    clap = request.app.state.clap
    emb = clap.get_text_embedding([req.query], use_tensor=False)
    emb = np.asarray(emb, dtype=np.float32)[0]
    # cosine normalize 
    emb = emb / (np.linalg.norm(emb) + 1e-9)
    emb_list = emb.flatten().tolist() if hasattr(emb, 'ndim') and emb.ndim > 1 else emb.tolist()
    
    print(f"Received query: {req.query}")

    # Try the RPC call
    res = supabase.rpc(
        "match_presets",
        {"query_embedding": emb_list, "match_count": req.k}
    ).execute()

    return {
        "query_received": req.query,
        "k": req.k,
        "results": res.data
    }