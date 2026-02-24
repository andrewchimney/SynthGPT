# Main server file, will process requests and use logic from rag folder to respond to frontend requests

from contextlib import asynccontextmanager
import os
from typing import Optional
import asyncpg

from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query, UploadFile, File as FastAPIFile
from dotenv import load_dotenv 

load_dotenv()
OLLAMA_BASE_URL = "http://ollama:11434"
OLLAMA_MODEL = "qwen2.5:7b-instruct"

from fastapi.middleware.cors import CORSMiddleware
import httpx

import laion_clap

VITA_CONVERTER_URL = os.getenv("VITA_CONVERTER_URL")  # e.g. http://vita-converter:5000


from rag.retrieve import router as retrieve_router

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
    print("Loading CLAP model")
    app.state.clap = load_model()
    print("CLAP model loaded)")

    yield
    
    del app.state.clap


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


# ==================== PRESET UPLOAD API ====================

SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

@app.post("/api/presets/upload")
async def upload_preset(
    file: UploadFile = FastAPIFile(...),
    title: str = Query("Uploaded Preset"),
):
    """Upload a .vital preset file, store in Supabase storage, and create a DB record"""
    if not file.filename or not file.filename.endswith(".vital"):
        raise HTTPException(status_code=400, detail="Only .vital files are accepted")

    contents = await file.read()

    # Create DB record first to get the preset ID
    conn = await asyncpg.connect(DATABASE_URL)
    row = await conn.fetchrow("""
        INSERT INTO presets (title, visibility, supabase_key, preset_object_key, source)
        VALUES ($1, 'public', '', '', 'upload')
        RETURNING id
    """, title)
    preset_id = str(row["id"])

    # Upload to Supabase Storage
    object_key = f"{preset_id}/preset.vital"
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        async with httpx.AsyncClient() as client:
            upload_url = f"{SUPABASE_URL}/storage/v1/object/presets/{object_key}"
            resp = await client.post(
                upload_url,
                content=contents,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/octet-stream",
                },
            )
            if resp.status_code not in (200, 201):
                # Still return the preset_id even if storage fails, post can exist without file in storage
                print(f"Warning: Failed to upload to storage: {resp.status_code} {resp.text}")

    # Update DB record with the object key
    await conn.execute("""
        UPDATE presets SET supabase_key = $1, preset_object_key = $1
        WHERE id = $2
    """, object_key, row["id"])

    # ── Generate .wav audio preview via vita-converter microservice ──
    preview_object_key = None
    if VITA_CONVERTER_URL:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                convert_resp = await client.post(
                    f"{VITA_CONVERTER_URL}/convert",
                    files={"file": ("preset.vital", contents, "application/octet-stream")},
                )
            if convert_resp.status_code == 200:
                wav_bytes = convert_resp.content
                # Upload .wav to Supabase previews bucket
                preview_object_key = f"{preset_id}/preview.wav"
                if SUPABASE_URL and SUPABASE_SERVICE_KEY:
                    async with httpx.AsyncClient() as client:
                        preview_upload_url = f"{SUPABASE_URL}/storage/v1/object/previews/{preview_object_key}"
                        prev_resp = await client.post(
                            preview_upload_url,
                            content=wav_bytes,
                            headers={
                                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                                "Content-Type": "audio/wav",
                            },
                        )
                        if prev_resp.status_code not in (200, 201):
                            print(f"Warning: Failed to upload preview: {prev_resp.status_code} {prev_resp.text}")
                            preview_object_key = None

                    # Update DB with preview_object_key
                    if preview_object_key:
                        await conn.execute("""
                            UPDATE presets SET preview_object_key = $1
                            WHERE id = $2
                        """, preview_object_key, row["id"])
            else:
                print(f"Warning: vita-converter returned {convert_resp.status_code}: {convert_resp.text}")
        except Exception as e:
            print(f"Warning: Audio preview generation failed: {e}")
            preview_object_key = None
    else:
        print("Skipping audio preview generation: VITA_CONVERTER_URL not set")

    await conn.close()

    return {"id": preset_id, "object_key": object_key, "preview_object_key": preview_object_key}


@app.post("/api/presets/{preset_id}/generate-preview")
async def generate_preset_preview(preset_id: str):
    """Generate a .wav audio preview for an existing preset that doesn't have one yet.
    Downloads the .vital from Supabase storage, sends to vita-converter, uploads preview, updates DB."""
    if not VITA_CONVERTER_URL:
        raise HTTPException(status_code=503, detail="Audio preview generation unavailable: VITA_CONVERTER_URL not set")

    conn = await asyncpg.connect(DATABASE_URL)
    row = await conn.fetchrow("""
        SELECT preset_object_key, preview_object_key FROM presets WHERE id = $1
    """, preset_id)

    if not row or not row["preset_object_key"]:
        await conn.close()
        raise HTTPException(status_code=404, detail="Preset not found or has no .vital file")

    # Skip if preview already exists
    if row["preview_object_key"]:
        await conn.close()
        return {"preview_url": get_preview_url(row["preview_object_key"]), "status": "already_exists"}

    # Download the .vital file from Supabase storage
    preset_url = f"{PRESETS_BUCKET}/{row['preset_object_key']}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(preset_url)
        if resp.status_code != 200:
            await conn.close()
            raise HTTPException(status_code=502, detail="Failed to download preset from storage")
        vital_bytes = resp.content

    # Send .vital to vita-converter microservice
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            convert_resp = await client.post(
                f"{VITA_CONVERTER_URL}/convert",
                files={"file": ("preset.vital", vital_bytes, "application/octet-stream")},
            )
        if convert_resp.status_code != 200:
            await conn.close()
            raise HTTPException(status_code=502, detail=f"vita-converter error: {convert_resp.status_code} {convert_resp.text}")
        wav_bytes = convert_resp.content
    except httpx.HTTPError as e:
        await conn.close()
        raise HTTPException(status_code=502, detail=f"Failed to reach vita-converter: {e}")

    # Upload .wav to Supabase previews bucket
    preview_object_key = f"{preset_id}/preview.wav"
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        async with httpx.AsyncClient() as client:
            preview_upload_url = f"{SUPABASE_URL}/storage/v1/object/previews/{preview_object_key}"
            prev_resp = await client.post(
                preview_upload_url,
                content=wav_bytes,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "audio/wav",
                },
            )
            if prev_resp.status_code not in (200, 201):
                await conn.close()
                raise HTTPException(status_code=502, detail=f"Failed to upload preview to storage: {prev_resp.status_code}")

    # Update DB
    await conn.execute("""
        UPDATE presets SET preview_object_key = $1 WHERE id = $2
    """, preview_object_key, preset_id)
    await conn.close()

    return {"preview_url": get_preview_url(preview_object_key), "status": "generated"}


# ==================== POSTS API ====================

@app.get("/api/posts")
async def get_posts(search: Optional[str] = Query(None)):
    """Get all posts with author info"""
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Base query will always filter by public visibility
    if search:
        # Search in title or description 
        rows = await conn.fetch("""
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
        WHERE p.visibility = 'public'
            AND (p.title ILIKE $1 OR p.description ILIKE $1) 
        ORDER BY p.created_at DESC    """, f"%{search}%")
    else:
        # No search: return all public posts
        rows = await conn.fetch("""
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
        WHERE p.visibility = 'public'
        ORDER BY p.created_at DESC
    """)
        
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
    # Check if user is authenticated
    if not user_id:
        raise HTTPException(status_code=401, detail="User must be authenticated to create a post")
    
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
async def delete_post(post_id: str, user_id: Optional[str] = Query(None)):
    """Delete a post"""
    # Check if user is authenticated
    if not user_id:
        raise HTTPException(status_code=401, detail="User must be authenticated to delete a post")
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Verify the user owns this post
    row = await conn.fetchrow("""
        SELECT owner_user_id FROM posts WHERE id = $1
    """, post_id)
    
    if not row:
        await conn.close()
        raise HTTPException(status_code=404, detail="Post not found")
    
    if str(row["owner_user_id"]) != user_id:
        await conn.close()
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    # Delete the post
    await conn.execute("""
        DELETE FROM posts WHERE id = $1
    """, post_id)
    
    await conn.close()
    
    return {"ok": True}


# ==================== VOTES API ====================

@app.post("/api/posts/{post_id}/upvote")
async def upvote_post(post_id: str, user_id: Optional[str] = Query(None)):
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
async def downvote_post(post_id: str, user_id: Optional[str] = Query(None)):
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
    # Check if user is authenticated
    if not user_id:
        raise HTTPException(status_code=401, detail="User must be authenticated to create a comment")
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
async def upvote_comment(comment_id: str, user_id: Optional[str] = Query(None)):
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
async def downvote_comment(comment_id: str, user_id: Optional[str] = Query(None)):
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

@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str, user_id: Optional[str] = Query(None)):
    """Delete a comment"""
    if not user_id:
        raise HTTPException(status_code=401, detail="User must be authenticated to delete a comment")
    
    conn = await asyncpg.connect(DATABASE_URL)
    
    row = await conn.fetchrow("""
        SELECT owner_user_id FROM comments WHERE id = $1
    """, comment_id)
    
    if not row:
        await conn.close()
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if str(row["owner_user_id"]) != user_id:
        await conn.close()
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    await conn.execute("""
        DELETE FROM comments WHERE id = $1
    """, comment_id)
    
    await conn.close()
    
    return {"ok": True}