CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;
GRANT USAGE ON SCHEMA auth TO postgres; 
GRANT SELECT ON auth.users TO postgres;
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  generation_preferences TEXT
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow auth trigger to insert user"
ON public.users
FOR INSERT
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
BEGIN
  base_username := COALESCE(
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'full_name',
    'user'
  );

  final_username := lower(regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g'))
                    || '_' || substr(new.id::text, 1, 8);

  INSERT INTO public.users (id, username, generation_preferences)
  VALUES (new.id, final_username, NULL);

  RETURN new;
END;
$$;
ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

CREATE POLICY "Users can read their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

CREATE TABLE presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  visibility TEXT DEFAULT 'public',
  supabase_key TEXT NOT NULL,
  preset_object_key TEXT NOT NULL DEFAULT '',
  preview_object_key TEXT,
  embedding VECTOR(384),
  source TEXT DEFAULT 'seed',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  preset_id UUID REFERENCES presets(id),
  title TEXT NOT NULL,
  description TEXT,
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMP DEFAULT NOW(),
  votes INTEGER DEFAULT 0

);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  body TEXT NOT NULL,
  visibility TEXT DEFAULT 'public',
  created_at TIMESTAMP DEFAULT NOW(),
  votes INTEGER DEFAULT 0,
  preset_id UUID REFERENCES presets(id) 

);


CREATE INDEX presets_owner_idx ON presets(owner_user_id);
CREATE INDEX presets_embedding_idx ON presets USING ivfflat (embedding);


