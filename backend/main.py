# Main server file, will process requests and use logic from rag folder to respond to frontend requests

from contextlib import asynccontextmanager
import json
import os
from typing import Optional
import asyncpg
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from dotenv import load_dotenv 

load_dotenv()
# Legacy Ollama config - now managed by llm/providers.py
# Use LLM_PROVIDER env var to switch between openai, gemini, ollama
OLLAMA_BASE_URL = "http://ollama:11434"
OLLAMA_MODEL = "qwen2.5:7b-instruct"

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx

import laion_clap


from rag.retrieve import router as retrieve_router
from llm import get_llm, get_generation_chain, get_rag_chain
from llm.providers import check_provider_health, get_provider_config, LLMProvider
from scripts.modify_preset import apply_patch_dict
try:
    from scripts.render import render_preset_to_wav_b64
    _vita_available = True
except Exception:
    _vita_available = False
    def render_preset_to_wav_b64(*_a, **_kw):  # type: ignore[misc]
        return None

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
PRESETS_BUCKET = os.getenv("PRESETS_BUCKET")
PREVIEWS_BUCKET = os.getenv("PREVIEWS_BUCKET")


def load_model():
    model = laion_clap.CLAP_Module(enable_fusion=False)
    model.load_ckpt()
    return model

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("Loading CLAP model...")
        app.state.clap = load_model()
        print("CLAP model loaded.")
    except Exception as exc:
        print(f"WARNING: CLAP model failed to load ({exc}). Retrieval will be unavailable.")
        app.state.clap = None

    yield

    if getattr(app.state, "clap", None) is not None:
        del app.state.clap


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class PostCreate(BaseModel):
    title: str
    description: Optional[str] = None
    preset_id: Optional[str] = None
    visibility: Optional[str] = "public"

class ReactionCreate(BaseModel):
    reaction_type: str  # "like" or "dislike"

# Pydantic models for LLM endpoints
class GenerateRequest(BaseModel):
    description: str
    context: Optional[str] = None
    provider: Optional[str] = None  # "openai", "gemini", or "ollama"
    stream: bool = False


class ChatRequest(BaseModel):
    message: str
    history: Optional[list] = None
    provider: Optional[str] = None


class ModifyPresetRequest(BaseModel):
    preset_id: Optional[str] = None
    preset_data: Optional[dict] = None
    description: str
    context: Optional[str] = None
    provider: Optional[str] = None


@app.get("/api/health")
def health():
    return {"ok": True}


# ==================== LLM API ====================

@app.get("/api/llm/health")
async def llm_health(provider: Optional[str] = Query(None)):
    """Check if the LLM provider is available and responding"""
    result = await check_provider_health(provider)
    return result


@app.get("/api/llm/config")
def llm_config():
    """Get current LLM configuration"""
    config = get_provider_config()
    return {
        "provider": config.provider.value,
        "model": config.model,
        "temperature": config.temperature,
        "base_url": config.base_url if config.provider == LLMProvider.OLLAMA else None,
    }


@app.get("/api/llm/providers")
def list_providers():
    """List available LLM providers"""
    return {
        "providers": [
            {
                "id": "openai",
                "name": "OpenAI",
                "models": ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
                "requires_api_key": True,
                "env_var": "OPENAI_API_KEY",
            },
            {
                "id": "gemini",
                "name": "Google Gemini",
                "models": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"],
                "requires_api_key": True,
                "env_var": "GOOGLE_API_KEY",
            },
            {
                "id": "ollama", 
                "name": "Ollama (Local)",
                "models": ["qwen2.5:7b-instruct", "llama3", "mistral", "codellama"],
                "requires_api_key": False,
                "env_var": None,
            },
        ],
        "current": get_provider_config().provider.value,
    }


@app.post("/api/generate")
async def generate_preset(req: GenerateRequest):
    """Generate preset suggestions from a text description"""
    try:
        chain = get_generation_chain(provider=req.provider)
        
        if req.stream:
            # Streaming response
            async def generate_stream():
                async for chunk in chain.astream({
                    "description": req.description,
                    "context": req.context or ""
                }):
                    yield chunk
            
            return StreamingResponse(
                generate_stream(),
                media_type="text/plain"
            )
        else:
            # Non-streaming response
            result = await chain.ainvoke({
                "description": req.description,
                "context": req.context or ""
            })
            # Strip markdown code fences if the LLM wraps its output
            cleaned = result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                if cleaned.rstrip().endswith("```"):
                    cleaned = cleaned.rstrip()[:-3].rstrip()
            return {"result": cleaned}
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/api/modify-preset")
async def modify_preset_endpoint(req: ModifyPresetRequest):
    """Apply LLM-generated parameter changes to a Vital preset"""
    try:
        # --- 1. Resolve base preset data ---
        if req.preset_data is not None:
            base_preset = req.preset_data
        elif req.preset_id is not None:
            conn = await asyncpg.connect(DATABASE_URL)
            row = await conn.fetchrow(
                "SELECT preset_object_key FROM presets WHERE id = $1", req.preset_id
            )
            await conn.close()
            if not row or not row["preset_object_key"]:
                raise HTTPException(status_code=404, detail="Preset not found")
            preset_url = f"{PRESETS_BUCKET}/{row['preset_object_key']}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(preset_url)
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=resp.status_code,
                        detail=f"Failed to fetch preset from storage: {resp.status_code}",
                    )
                base_preset = resp.json()
        else:
            raise HTTPException(
                status_code=400,
                detail="Either preset_id or preset_data must be provided",
            )

        # --- 2. Run LLM chain ---
        chain = get_generation_chain(provider=req.provider)
        preset_context = json.dumps(base_preset.get("settings", {}), indent=2)
        result = await chain.ainvoke({
            "description": req.description,
            "context": preset_context,
        })

        # --- 3. Parse JSON output ---
        # Strip markdown code fences if present (e.g. ```json ... ```)
        try:
            cleaned = result.strip()
            if cleaned.startswith("```"):
                # Remove opening fence (```json or ```)
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                # Remove closing fence
                if cleaned.rstrip().endswith("```"):
                    cleaned = cleaned.rstrip()[:-3].rstrip()
            parsed = json.loads(cleaned)
            changes = parsed.get("changes", {})
            explanation = parsed.get("explanation", "")
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail=f"LLM returned invalid JSON: {result}",
            )

        # --- 4. Apply patch in-memory ---
        modified_preset = apply_patch_dict(base_preset, changes)

        # --- 5. Render audio preview ---
        import asyncio
        loop = asyncio.get_event_loop()
        audio_b64: str | None = await loop.run_in_executor(
            None, render_preset_to_wav_b64, modified_preset
        )

        # --- 6. Return ---
        return {
            "modified_preset": modified_preset,
            "changes": changes,
            "explanation": explanation,
            "audio_b64": audio_b64,
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Modification failed: {str(e)}")


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Chat with the LLM assistant"""
    try:
        from llm.chains import get_chat_chain
        
        chain = get_chat_chain(provider=req.provider)
        
        # Format history for the chain
        messages = []
        if req.history:
            for msg in req.history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        result = await chain.ainvoke({
            "messages": messages,
            "input": req.message
        })
        
        return {"response": result}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


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


# ==================== PRESET DATA API ====================

@app.get("/api/presets/{preset_id}/data")
async def get_preset_data(preset_id: str):
    """Fetch the .vital preset JSON data from Supabase storage"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Get the preset_object_key from the database
    row = await conn.fetchrow("""
        SELECT preset_object_key FROM presets WHERE id = $1
    """, preset_id)
    
    await conn.close()
    
    if not row or not row["preset_object_key"]:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    preset_object_key = row["preset_object_key"]
    
    # Fetch the preset file from Supabase storage
    preset_url = f"{PRESETS_BUCKET}/{preset_object_key}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(preset_url)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"Failed to fetch preset from storage: {response.status_code}"
            )
        
        return response.json()


def get_preview_url(preview_object_key: str | None) -> str | None:
    """Build the full preview URL from the object key"""
    if not preview_object_key or not PREVIEWS_BUCKET:
        return None
    return f"{PREVIEWS_BUCKET}/{preview_object_key}"


# ==================== POSTS API ====================

@app.get("/api/posts")
async def get_posts(search: Optional[str] = Query(None)):
    """Get all posts with author info"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    query = """
        SELECT 
            p.id,
            p.owner_user_id,
            p.preset_id,
            p.title,
            p.description,
            p.visibility,
            p.created_at,
            p.votes,
            u.username as author_username,
            pr.preview_object_key,
            pr.preset_object_key
        FROM posts p
        LEFT JOIN users u ON p.owner_user_id = u.id
        LEFT JOIN presets pr ON p.preset_id = pr.id
    """
    
    if search:
        query += " WHERE p.title ILIKE $1 OR p.description ILIKE $1"
        query += " ORDER BY p.created_at DESC"
        rows = await conn.fetch(query, f"%{search}%")
    else:
        query += " ORDER BY p.created_at DESC"
        rows = await conn.fetch(query)
    
    await conn.close()
    
    return {
        "posts": [
            {
                "id": str(r["id"]),
                "owner_user_id": str(r["owner_user_id"]) if r["owner_user_id"] else None,
                "preset_id": str(r["preset_id"]) if r["preset_id"] else None,
                "title": r["title"],
                "description": r["description"],
                "visibility": r["visibility"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "votes": r["votes"] or 0,
                "author": {
                    "username": r["author_username"]
                } if r["author_username"] else None,
                "preview_url": get_preview_url(r["preview_object_key"]),
            }
            for r in rows
        ]
    }


@app.get("/api/posts/{post_id}")
async def get_post(post_id: str):
    """Get a single post by ID"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        SELECT 
            p.id,
            p.owner_user_id,
            p.preset_id,
            p.title,
            p.description,
            p.visibility,
            p.created_at,
            p.votes,
            u.username as author_username,
            pr.preview_object_key
        FROM posts p
        LEFT JOIN users u ON p.owner_user_id = u.id
        LEFT JOIN presets pr ON p.preset_id = pr.id
        WHERE p.id = $1
    """, post_id)
    
    await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {
        "id": str(row["id"]),
        "owner_user_id": str(row["owner_user_id"]) if row["owner_user_id"] else None,
        "preset_id": str(row["preset_id"]) if row["preset_id"] else None,
        "title": row["title"],
        "description": row["description"],
        "visibility": row["visibility"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "votes": row["votes"] or 0,
        "author": {
            "username": row["author_username"]
        } if row["author_username"] else None,
        "preview_object_key": row["preview_object_key"],
    }


@app.post("/api/posts")
async def create_post(post: PostCreate, user_id: Optional[str] = Query(None)):
    """Create a new post"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        INSERT INTO posts (owner_user_id, title, description, preset_id, visibility, votes)
        VALUES ($1, $2, $3, $4, $5, 0)
        RETURNING id, created_at
    """, user_id, post.title, post.description, post.preset_id, post.visibility)
    
    await conn.close()
    
    return {
        "id": str(row["id"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a post"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    result = await conn.execute("""
        DELETE FROM posts WHERE id = $1
    """, post_id)
    
    await conn.close()
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"ok": True}


# ==================== VOTES API ====================

@app.post("/api/posts/{post_id}/upvote")
async def upvote_post(post_id: str):
    """Upvote a post (increment votes)"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        UPDATE posts SET votes = COALESCE(votes, 0) + 1
        WHERE id = $1
        RETURNING votes
    """, post_id)
    
    await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"votes": row["votes"]}


@app.post("/api/posts/{post_id}/downvote")
async def downvote_post(post_id: str):
    """Downvote a post (decrement votes)"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        UPDATE posts SET votes = COALESCE(votes, 0) - 1
        WHERE id = $1
        RETURNING votes
    """, post_id)
    
    await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return {"votes": row["votes"]}


# ==================== COMMENTS API ====================

@app.get("/api/posts/{post_id}/comments")
async def get_post_comments(post_id: str):
    """Get all comments for a post"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    rows = await conn.fetch("""
        SELECT 
            c.id,
            c.post_id,
            c.owner_user_id,
            c.body,
            c.visibility,
            c.created_at,
            c.votes,
            c.preset_id,
            u.username as author_username
        FROM comments c
        LEFT JOIN users u ON c.owner_user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
    """, post_id)
    
    await conn.close()
    
    return {
        "comments": [
            {
                "id": str(r["id"]),
                "post_id": str(r["post_id"]) if r["post_id"] else None,
                "owner_user_id": str(r["owner_user_id"]) if r["owner_user_id"] else None,
                "body": r["body"],
                "visibility": r["visibility"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "votes": r["votes"] or 0,
                "preset_id": str(r["preset_id"]) if r["preset_id"] else None,
                "author": {
                    "username": r["author_username"]
                } if r["author_username"] else None,
            }
            for r in rows
        ]
    }


class CommentCreate(BaseModel):
    body: str
    preset_id: Optional[str] = None
    visibility: Optional[str] = "public"


@app.post("/api/posts/{post_id}/comments")
async def create_comment(post_id: str, comment: CommentCreate, user_id: Optional[str] = Query(None)):
    """Create a comment on a post"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        INSERT INTO comments (post_id, owner_user_id, body, preset_id, visibility, votes)
        VALUES ($1, $2, $3, $4, $5, 0)
        RETURNING id, created_at
    """, post_id, user_id, comment.body, comment.preset_id, comment.visibility)
    
    await conn.close()
    
    return {
        "id": str(row["id"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@app.post("/api/comments/{comment_id}/upvote")
async def upvote_comment(comment_id: str):
    """Upvote a comment"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        UPDATE comments SET votes = COALESCE(votes, 0) + 1
        WHERE id = $1
        RETURNING votes
    """, comment_id)
    
    await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"votes": row["votes"]}


@app.post("/api/comments/{comment_id}/downvote")
async def downvote_comment(comment_id: str):
    """Downvote a comment"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        UPDATE comments SET votes = COALESCE(votes, 0) - 1
        WHERE id = $1
        RETURNING votes
    """, comment_id)
    
    await conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    return {"votes": row["votes"]}





