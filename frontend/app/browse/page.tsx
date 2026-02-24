"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { PresetViewer, parseVitalPreset, type ParsedPreset, type RawVitalPreset } from "../components/PresetViewer";
import { CreatePostDialog, PostForm, type PostFormValues } from "../components/CreatePost";
import { responseCookiesToRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

interface Post {
  id: string;
  title: string;
  description: string | null;
  preset_id: string | null;
  created_at: string;
  owner_user_id: string | null;
  visibility: string;
  votes: number;
  author?: {
    username: string;
  } | null;
  preview_url: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function BrowsePage() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  // New state for create post dialog and form (Sprint 3 - User Story 5)
  // showCreateDialog: Controls the authentication/anonymous choice dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // showPostForm: Controls the actual post creation form after the user chooses to authenticate or continue anonymously
  const [showPostForm, setShowPostForm] = useState(false);
  // postFormValues: Holds the form values for creating a new post
  const[postFormValues, setPostFormValues] = useState<PostFormValues>({
    title: "",
    description: "",
    preset_id: null,
    uploaded_file: null,
  });
  // isSubmitting: Indicates whether the post creation form is currently being submitted 
  const [isSubmitting, setIsSubmitting] = useState(false);
  // postError: Displays any errors that occur during post creation
  const [postError, setPostError] = useState<string | null>(null);


  const [postsLoading, setPostsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [parsedPresets, setParsedPresets] = useState<Record<string, ParsedPreset>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [presetData, setPresetData] = useState<Record<string, ParsedPreset | null>>({});
  const [presetLoading, setPresetLoading] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const router = useRouter();


  // Supabase client for auth only
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseAnonKey, supabaseUrl]);

  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch posts from backend API
  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    
    try {
      const url = searchQuery 
        ? `${API_URL}/posts?search=${encodeURIComponent(searchQuery)}`
        : `${API_URL}/posts`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch posts");
      
      const data = await response.json();
      setPosts(data.posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
    
    setPostsLoading(false);
  }, [searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Fetch preset data when expanding a post
  const handleExpandPost = useCallback(async (post: Post) => {
    // Toggle off if already expanded
    if (expandedPostId === post.id) {
      setExpandedPostId(null);
      return;
    }

    setExpandedPostId(post.id);

    // Check if we already have the preset data
    if (presetData[post.id]) return;

    // Fetch preset if we have a preset_id
    if (!post.preset_id) return;

    setPresetLoading(post.id);
    try {
      // Use backend API to fetch preset data
      const response = await fetch(`${API_URL}/presets/${post.preset_id}/data`);
      if (!response.ok) {
        console.error("Preset fetch failed:", response.status, response.statusText);
        throw new Error("Failed to fetch preset");
      }
      
      const rawPreset: RawVitalPreset = await response.json();
      const parsed = parseVitalPreset(rawPreset);
      
      setPresetData(prev => ({ ...prev, [post.id]: parsed }));
    } catch (error) {
      console.error("Error fetching preset:", error);
      setPresetData(prev => ({ ...prev, [post.id]: null }));
    } finally {
      setPresetLoading(null);
    }
  }, [expandedPostId, presetData]);

  // Handle upvote/downvote via backend API
  const handleVote = async (postId: string, direction: "up" | "down") => {
    if (!user) {
      setShowAuthPanel(true);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/posts/${postId}/${direction}vote`, {
        method: "POST",
      });
      
      if (response.ok) {
        const data = await response.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, votes: data.votes } : p
          )
        );
      }
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDiscordLogin = async () => {
    if (!supabase) {
      setAuthError("Supabase not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });

    setAuthLoading(false);
    if (error) setAuthError(error.message);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setShowAuthPanel(false);
  };

  // Create-post dialog displays a prompt when the user either signs up/logs in or continues anonymously when creating a new post
  const handlePostAnonymously = () => {
    setShowCreateDialog(false);  // Hide authentication choice dialog
    setShowPostForm(true);  // Open post form
  };

  /**
   * Handles the Create Post form submission
   * 1. Sends the form data to the backend API to create a new post
   * 2. Resets the form and closes the post form when a post is successfully created
   * 3. Refreshes the post list so the new post appears in the feed
  **/
  const handleSubmitPost = async () => {
    setIsSubmitting(true);  // Disables the form submit button to prevent multiple submissions
    setPostError(null);  // Clears any previous error messages

    try {
      // Responsible for sending the post creation request to the backend API
      let presetId = postFormValues.preset_id;

      // If user uploaded a .vital file, upload it first to get a preset_id
      if (postFormValues.uploaded_file) {
        const formData = new FormData();
        formData.append("file", postFormValues.uploaded_file);
        formData.append("title", postFormValues.title);

        const uploadRes = await fetch(`${API_URL}/presets/upload`, {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload preset");
        const uploadData = await uploadRes.json();
        presetId = uploadData.id;
      }

      const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postFormValues.title,  // Required
          description: postFormValues.description, // Optional
          preset_id: presetId, // Optional - from dropdown or uploaded file
          visibility: "public", // Required - determines the visibility of the post
        }),
      });

      // Accounts for any errors returned from the backend when creating a new post
      if (!response.ok) throw new Error("Failed to create post");

      // If the post is successfully created, this will reset the form values for the next time the user creates a post
      setPostFormValues({ title: "", description: "", preset_id: null, uploaded_file: null }); // This will close the form 
      setShowPostForm(false);

      // After creating a post, this will refresh the post list to show the newly created post
      await fetchPosts();
    } catch (error) {
      // Display any errors that occur during post creation in the form
      setPostError(error instanceof Error ? error.message: "Error creating post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-black">
        {/* Logo/Brand */}
        <Link href="/" className="text-xl font-semibold text-black dark:text-white hover:opacity-80 transition">
          Resonance
        </Link>
        
        {/* Search Box */}
        <div className="flex-1 mx-8 max-w-2xl">
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
          />
        </div>
        
        {/* Generate and Profile */}
        <div className="relative flex items-center gap-6">
          <Link href="/generate" className="text-sm font-medium text-black transition-colors hover:text-zinc-600 hover:underline dark:text-white dark:hover:text-zinc-300 cursor-pointer">
            Generate
          </Link>

        {/* Post Creation Button and Authentication/Account Panel - Sprint 3 US5 */}
          {/* Plus Button: opens post creation form */}
          <button
            onClick={() => {
              // If the user is logged in, show the post creation form directly
              if (user) {
                setShowPostForm(true);
              } else {
                // If not logged in, show the authentication/anonymous choice dialog
                setShowCreateDialog(true);
              }
            }}
            title="Create a post"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 transition-colors hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 cursor-pointer"
          >
            {/* Plus Icon */}
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>

          {user ? (
            <button
              aria-label="Profile"
              onClick={() => setShowAuthPanel((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer"
            >
              <svg
                className="h-5 w-5 text-zinc-600 dark:text-zinc-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthPanel((open) => !open)}
              className="text-sm font-medium text-black transition-colors hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300 cursor-pointer"
            >
              Log In
            </button>
          )}

          {showAuthPanel && (
            <div className="fixed right-6 top-16 z-50 w-80 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900">
              {!supabase && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
                </div>
              )}

              {supabase && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-black dark:text-white">Account</div>
                    <button
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      onClick={() => setShowAuthPanel(false)}
                    >
                      Close
                    </button>
                  </div>
                    {user ? (
                   <div className="space-y-3">
                  <button
                    onClick={() => router.push("/profile")}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 text-left hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 w-full"
                    >
                    Signed in as <span className="font-medium">{user.email}</span>
                    </button>
                    <button
                    onClick={handleSignOut}
                  className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                          >
                        Sign out
                      </button>
                    </div>
                  ) : (

                    <div className="space-y-3">
                      <div className="text-sm text-zinc-700 dark:text-zinc-200">Sign in to continue</div>
                      <button
                        onClick={handleDiscordLogin}
                        disabled={authLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                      >
                        <span aria-hidden>💬</span>
                        {authLoading ? "Redirecting..." : "Continue with Discord"}
                      </button>
                      {authError && <div className="text-xs text-red-600 dark:text-red-400">{authError}</div>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content - Posts Feed */}
      <main className="flex flex-1 w-full justify-center bg-white dark:bg-black px-8 py-8">
        <div className="w-full max-w-2xl">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-black dark:text-white">Browse</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">Discover synth presets shared by the community</p>
          </div>

          {/* Posts List */}
          {postsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-zinc-500 dark:text-zinc-400">Loading posts...</div>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-zinc-500 dark:text-zinc-400">
                {searchQuery ? "No posts match your search" : "No posts yet. Be the first to share!"}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <svg
                          className="h-5 w-5 text-zinc-600 dark:text-zinc-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-black dark:text-white">
                          {post.author?.username || "Anonymous"}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                          {formatDate(post.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Post Content */}
                  <h2 className="text-xl font-semibold text-black dark:text-white mb-2">
                    {post.title}
                  </h2>
                  {post.description && (
                    <p className="text-zinc-700 dark:text-zinc-300 mb-4">{post.description}</p>
                  )}

                  {/* Audio Player - from preset's preview */}
                  {post.preview_url && (
                    <div className="mb-4">
                      <audio
                        controls
                        className="w-full h-10 rounded-lg"
                        src={post.preview_url}
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}

                  {/* Preset Viewer */}
                  {parsedPresets[post.id] && (
                    <div className="mb-4">
                      <PresetViewer 
                        preset={parsedPresets[post.id]} 
                        presetName={post.title}
                        compact
                      />
                    </div>
                  )}

                  {/* Post Actions */}
                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    {/* Upvote Button */}
                    <button
                      onClick={() => handleVote(post.id, "up")}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>

                    {/* Vote Count */}
                    <span className="text-sm font-medium text-black dark:text-white min-w-[2rem] text-center">
                      {post.votes}
                    </span>

                    {/* Downvote Button */}
                    <button
                      onClick={() => handleVote(post.id, "down")}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Comment Button (placeholder for now) */}
                    <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition ml-4">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span>Comments</span>
                    </button>

                    {/* View Preset Button */}
                    {post.preset_id && (
                      <button 
                        onClick={() => handleExpandPost(post)}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition ml-auto"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                          />
                        </svg>
                        <span>{expandedPostId === post.id ? "Hide Preset" : "View Preset"}</span>
                        <svg 
                          className={`h-4 w-4 transition-transform ${expandedPostId === post.id ? "rotate-180" : ""}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Preset Viewer - Expandable */}
                  {expandedPostId === post.id && (
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      {presetLoading === post.id ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-zinc-500 dark:text-zinc-400">Loading preset...</div>
                        </div>
                      ) : presetData[post.id] ? (
                        <PresetViewer 
                          preset={presetData[post.id]!} 
                          presetName={post.title.split(' - ')[0]}
                          uploadDate={new Date(post.created_at)}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-zinc-500 dark:text-zinc-400">Could not load preset data</div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Post Creation Dialog shown to non-logged in users */}
      <CreatePostDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onPostAnonymously={handlePostAnonymously}
      />

      {/* Actual post creation form */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-bold text-black dark:text-white">
              Create a Post
            </h2>
            <PostForm
              presets={[]} // TODO: Pass the actual presets later when implementing preset attachment to posts
              values={postFormValues}
              onChange={setPostFormValues}
              onSubmit={handleSubmitPost}
              isSubmitting={isSubmitting}
              error={postError}
            />
            <button
              onClick={() => setShowPostForm(false)}
              className="mt-4 w-full rounded bg-zinc-100 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700" 
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}