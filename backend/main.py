# Main server file, will process requests and use logic from rag folder to respond to frontend requests

import os
import asyncpg
from pydantic import BaseModel
from fastapi import FastAPI
from dotenv import load_dotenv 
load_dotenv()


from rag.retrieve import router as retrieve_router

DATABASE_URL = os.getenv("DATABASE_URL")



app = FastAPI()

@app.get("/api/health")
def health():
    return {"ok": True}


class RetrieveRequest(BaseModel):
    query: str
    k: int = 10

app.include_router(retrieve_router)


@app.get("/api/presets")
async def get_presets():
    conn = await asyncpg.connect(DATABASE_URL)
    rows = await conn.fetch("""
        SELECT
            id,
            owner_user_id,
            title,
            description,
            visibility,
            preset_object_key,
            preview_object_key,
            source,
            created_at
        FROM public.presets
        ORDER BY created_at DESC
    """)
    await conn.close()

    return {
        "presets": [
            {
                "id": str(r["id"]),
                "owner_user_id": str(r["owner_user_id"]) if r["owner_user_id"] else None,
                "title": r["title"],
                "description": r["description"],
                "visibility": r["visibility"],
                "preset_object_key": r["preset_object_key"],
                "preview_object_key": r["preview_object_key"],
                "source": r["source"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    }

@app.get("/api/user/{id}")
async def get_user_id(id: str):
    conn = await asyncpg.connect(DATABASE_URL)
    row = await conn.fetchrow("""
        SELECT
            id,
            username,
            email,
            created_at,
            generation_prefrences
        FROM public.users
        WHERE id = $1
    """, id)

    await conn.close()

    if not row:
        return {"error": "User not found"}

    return {
        "user": {
            "id": str(row["id"]),
            "username": row["username"],
            "email": row["email"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "generation_prefrences": row["generation_prefrences"],
        }
    }




# API Endpoints:
# Auth / Users
# 	•	POST /api/auth/register
# 	•	POST /api/auth/login
# 	•	GET /api/users/profile
# 	•	GET /api/users/{user_id}

# Presets
# 	•	POST /api/presets
# 	•	GET /api/presets/{id}
# 	•	DELETE /api/presets/{id}
# 	•	POST /api/presets/{id}/render
# 	•	GET /api/presets/{id}/render
# 	•	GET /api/presets
# 	•	GET /api/presets/{id}/download

# Generate
# 	•	POST /api/generate





