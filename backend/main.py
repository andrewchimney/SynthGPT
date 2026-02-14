# Main server file, will process requests and use logic from rag folder to respond to frontend requests

from contextlib import asynccontextmanager
import os
import asyncpg
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, Query
from dotenv import load_dotenv 

load_dotenv()
OLLAMA_BASE_URL = "http://ollama:11434"
OLLAMA_MODEL = "qwen2.5:7b-instruct"

from fastapi.middleware.cors import CORSMiddleware

import laion_clap


from rag.retrieve import router as retrieve_router

DATABASE_URL = os.getenv("DATABASE_URL")


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
            pr.preview_object_key
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
                "preview_object_key": r["preview_object_key"],
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





