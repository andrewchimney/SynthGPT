import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

async def check_schema():
    conn = await asyncpg.connect(DATABASE_URL)
    
    # Get users columns
    cols = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'"
    )
    print('Users table columns:')
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']}")
    
    # Get presets columns
    cols = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'presets'"
    )
    print('\nPresets table columns:')
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']}")
    
    # Get posts columns  
    cols = await conn.fetch(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts'"
    )
    print('\nPosts table columns:')
    for c in cols:
        print(f"  {c['column_name']}: {c['data_type']}")
        
    await conn.close()

asyncio.run(check_schema())
