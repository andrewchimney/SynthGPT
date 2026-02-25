#!/usr/bin/env python3
"""
Seed test data for SynthGPT - creates a dummy post with preset and audio preview
"""

import os
import sys
import uuid
import random
import asyncio
import json
from pathlib import Path

import asyncpg
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Random usernames for testing
USERNAMES = [
    "synthwave_wizard", "bass_dropper", "ambient_dreams", "neurofunk_nerd",
    "pad_master", "lead_machine", "growl_guru", "atmospheres_inc",
    "wobble_factory", "melodic_mind", "future_bass_kid", "dnb_architect"
]

# Find preset files
VITAL_DIR = Path("/Users/shiva/Music/Vital")

def find_preset_files():
    """Find all .vital preset files"""
    presets = list(VITAL_DIR.rglob("*.vital"))
    return presets

async def create_test_user(conn: asyncpg.Connection) -> tuple[str, str]:
    """Create a test user and return (user_id, username)"""
    username = random.choice(USERNAMES) + "_" + str(random.randint(100, 999))
    
    # Check if any user exists - we'll use an existing one or create in auth.users
    existing = await conn.fetchrow(
        "SELECT id, username FROM public.users WHERE username IS NOT NULL LIMIT 1"
    )
    if existing:
        print(f"✓ Using existing user: {existing['username']} ({existing['id']})")
        return str(existing['id']), existing['username']
    
    # Create new user in public.users table (Supabase schema)
    user_id = await conn.fetchval(
        """
        INSERT INTO public.users (id, username, created_at)
        VALUES (gen_random_uuid(), $1, NOW())
        RETURNING id
        """,
        username
    )
    print(f"✓ Created user: {username} ({user_id})")
    return str(user_id), username

def upload_to_supabase(supabase: Client, bucket: str, file_path: Path, dest_path: str) -> str:
    """Upload a file to Supabase storage and return the public URL"""
    with open(file_path, "rb") as f:
        data = f.read()
    
    # Upload file
    result = supabase.storage.from_(bucket).upload(
        dest_path,
        data,
        file_options={"content-type": "application/octet-stream", "upsert": "true"}
    )
    
    # Get public URL
    public_url = supabase.storage.from_(bucket).get_public_url(dest_path)
    return dest_path  # Return just the path, not full URL

async def create_preset_record(
    conn: asyncpg.Connection,
    user_id: str,
    title: str,
    preset_key: str,
    preview_key: str | None
) -> str:
    """Create a preset record in the database"""
    preset_id = await conn.fetchval(
        """
        INSERT INTO presets (owner_user_id, title, preset_object_key, preview_object_key, source)
        VALUES ($1, $2, $3, $4, 'seed')
        RETURNING id
        """,
        uuid.UUID(user_id), title, preset_key, preview_key
    )
    print(f"✓ Created preset: {title} ({preset_id})")
    return str(preset_id)

async def create_post_record(
    conn: asyncpg.Connection,
    user_id: str,
    preset_id: str,
    title: str,
    description: str
) -> str:
    """Create a post record in the database"""
    post_id = await conn.fetchval(
        """
        INSERT INTO posts (owner_user_id, preset_id, title, description, visibility, votes)
        VALUES ($1, $2, $3, $4, 'public', $5)
        RETURNING id
        """,
        uuid.UUID(user_id), uuid.UUID(preset_id), title, description, random.randint(0, 50)
    )
    print(f"✓ Created post: {title} ({post_id})")
    return str(post_id)

def generate_audio_preview(preset_path: Path, output_path: Path) -> bool:
    """
    Generate an audio preview for the preset.
    For now, we'll use a placeholder - in production you'd render audio from Vital.
    """
    # For testing, we'll create a simple sine wave WAV file
    import wave
    import struct
    import math
    
    sample_rate = 44100
    duration = 3  # seconds
    frequency = 440  # Hz (A4 note)
    
    # Generate simple sine wave with envelope
    num_samples = int(sample_rate * duration)
    samples = []
    
    for i in range(num_samples):
        t = i / sample_rate
        # Simple ADSR envelope
        if t < 0.1:  # Attack
            amp = t / 0.1
        elif t < 0.3:  # Decay
            amp = 1.0 - 0.3 * ((t - 0.1) / 0.2)
        elif t < duration - 0.5:  # Sustain
            amp = 0.7
        else:  # Release
            amp = 0.7 * (duration - t) / 0.5
        
        # Add some harmonics for richness
        sample = amp * (
            0.5 * math.sin(2 * math.pi * frequency * t) +
            0.3 * math.sin(2 * math.pi * frequency * 2 * t) +
            0.2 * math.sin(2 * math.pi * frequency * 3 * t)
        )
        samples.append(int(sample * 32767 * 0.5))
    
    # Write WAV file
    with wave.open(str(output_path), 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for sample in samples:
            wav_file.writeframes(struct.pack('<h', sample))
    
    return True

async def seed_test_data(num_posts: int = 3):
    """Main function to seed test data"""
    print("\n🌱 Seeding test data for SynthGPT...\n")
    
    # Initialize Supabase client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Missing Supabase credentials in .env")
        return
    
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # Connect to database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Find preset files
        preset_files = find_preset_files()
        if not preset_files:
            print("❌ No preset files found in", VITAL_DIR)
            return
        
        print(f"📁 Found {len(preset_files)} preset files\n")
        
        # Create test posts
        for i in range(min(num_posts, len(preset_files))):
            preset_path = preset_files[i]
            preset_name = preset_path.stem
            
            print(f"\n--- Creating post {i+1}/{num_posts}: {preset_name} ---")
            
            # Create user
            user_id, username = await create_test_user(conn)
            
            # Upload preset to Supabase storage
            preset_key = f"test/{uuid.uuid4()}/{preset_name}.vital"
            try:
                upload_to_supabase(supabase, "presets", preset_path, preset_key)
                print(f"✓ Uploaded preset: {preset_key}")
            except Exception as e:
                print(f"⚠ Preset upload failed (bucket may not exist): {e}")
                preset_key = f"test/{preset_name}.vital"  # Use placeholder
            
            # Generate and upload audio preview
            preview_key = None
            temp_preview = Path(f"/tmp/{preset_name}_preview.wav")
            try:
                if generate_audio_preview(preset_path, temp_preview):
                    preview_key = f"test/{uuid.uuid4()}/{preset_name}_preview.wav"
                    upload_to_supabase(supabase, "previews", temp_preview, preview_key)
                    print(f"✓ Uploaded preview: {preview_key}")
                    temp_preview.unlink()  # Clean up temp file
            except Exception as e:
                print(f"⚠ Preview upload failed: {e}")
                # Keep preview_key as None
            
            # Read preset to get some metadata for description
            try:
                with open(preset_path) as f:
                    preset_data = json.load(f)
                    settings = preset_data.get("settings", {})
                    wavetables = preset_data.get("wavetables", [])
                    
                    # Extract some info for description
                    osc_names = []
                    for i_osc in range(1, 4):
                        if settings.get(f"osc_{i_osc}_on", 0) == 1:
                            wt_name = settings.get(f"osc_{i_osc}_wavetable_name", "")
                            if wt_name:
                                osc_names.append(wt_name)
                    
                    description = f"A {'bass' if 'bass' in preset_name.lower() else 'synth'} preset"
                    if osc_names:
                        description += f" using {', '.join(osc_names[:2])} wavetables"
            except:
                description = f"An awesome preset called {preset_name}"
            
            # Create preset record
            preset_id = await create_preset_record(
                conn, user_id, preset_name, preset_key, preview_key
            )
            
            # Create post record
            post_title = f"{preset_name} - {random.choice(['FREE', 'Check this out!', 'New preset', 'My latest creation'])}"
            await create_post_record(conn, user_id, preset_id, post_title, description)
        
        print("\n✅ Test data seeded successfully!")
        print(f"\n📊 Summary:")
        print(f"   - Posts created: {num_posts}")
        print(f"   - Visit http://localhost:3000/browse to see them")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    num = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    asyncio.run(seed_test_data(num))
