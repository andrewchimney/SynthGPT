from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
from supabase import create_client
import laion_clap
import os

clap = laion_clap.CLAP_Module(enable_fusion=False)
clap.load_ckpt()


SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

router = APIRouter()

import json

class RetrieveRequest(BaseModel):
    query: str
    k: int = 10

@router.post("/api/retrieve")
def retrieve(req: RetrieveRequest):
    
    uuid = "example-uuid-12345"
    
    emb = clap.get_text_embedding([req.query], use_tensor=False)
    emb = np.asarray(emb, dtype=np.float32)[0]


    # cosine normalize (recommended since you indexed with vector_cosine_ops)
    emb = emb / (np.linalg.norm(emb) + 1e-9)


    test = supabase.table("presets").select("id").limit(5).execute()
    # 2) similarity search via RPC
    # res = supabase.rpc(
    #     "match_presets",
    #     {"query_embedding": emb.tolist(), "match_count": req.k},
    # ).execute()
    

    
    emb_list = emb.flatten().tolist() if hasattr(emb, 'ndim') and emb.ndim > 1 else emb.tolist()

    print(f"=== Debug Info ===")
    print(f"Embedding length: {len(emb_list)}")
    print(f"Embedding type: {type(emb_list)}")
    print(f"First element type: {type(emb_list[0])}")
    print(f"Embedding sample: {emb_list[:5]}")

    # Check if it's JSON serializable
    try:
        json_str = json.dumps(emb_list)
        print(f"JSON serialization: OK (length: {len(json_str)})")
    except Exception as e:
        print(f"JSON serialization FAILED: {e}")

    # Try the RPC call
    res = supabase.rpc(
        "match_presets",
        {"query_embedding": emb_list, "match_count": req.k}
    ).execute()

    print(f"Returned count: {len(res.data) if res.data else 0}")

    # Check if all results have scores
    if res.data:
        for i, item in enumerate(res.data):
            print(f"Result {i}: score={item.get('score')}")
    
    return {
        "query_received": req.query,
        "k": req.k,
        "results": res.data
    }