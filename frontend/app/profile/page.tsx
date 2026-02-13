"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface HistoryData {
  id: string;
  email: string;
  username: string | null;
  presets_generated: number;
  posts_created: number;
  created_at?: string;
}

interface UserProfile {
  username: string | null;
  created_at?: string;
}

interface PresetData {
  id: string;
  uuid: string;
  name: string;
  created_at: string;
}

interface PostData {
  id: string;
  uuid: string;
  title: string;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAccountPopup, setShowAccountPopup] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [showPreferencesPopup, setShowPreferencesPopup] = useState(false);
  const [generationPreferences, setGenerationPreferences] = useState("");
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // New states for History and Posts
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [showPostsPopup, setShowPostsPopup] = useState(false);
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = useMemo(
    () => createClient(supabaseUrl, supabaseAnonKey),
    [supabaseUrl, supabaseAnonKey]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;

      const currentUser = data.session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        router.push("/");
        return;
      }

      // PROFILE PICTURE 
      const { data: profile } = await supabase
        .from("users")
        .select("profile_picture, username, generation_preferences, created_at")
        .eq("id", currentUser.id)
        .single();

      if (profile?.profile_picture) {
        const { data } = supabase.storage
          .from("profile_pictures")
          .getPublicUrl(profile.profile_picture);
        setProfileUrl(data.publicUrl);
      }
      
      setUserProfile({
        username: profile?.username || null,
        created_at: profile?.created_at
      });
      
      if (profile?.username) {
        setNewUsername(profile.username);
      }
      
      if (profile?.generation_preferences) {
        setGenerationPreferences(profile.generation_preferences);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, router]);

  async function uploadProfilePicture(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file || !user) return;

      const filePath = `${user.id}/${Date.now()}-${file.name}`;

      await supabase.storage
        .from("profile_pictures")
        .upload(filePath, file, { upsert: true });

      await supabase
        .from("users")
        .update({ profile_picture: filePath })
        .eq("id", user.id);

      const { data } = supabase.storage
        .from("profile_pictures")
        .getPublicUrl(filePath);

      setProfileUrl(data.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  async function fetchAccountData() {
    if (!user) return;
    
    try {
      setLoadingAccount(true);
      
      // Fetch user profile data
      const { data: profile } = await supabase
        .from("users")
        .select("username, created_at")
        .eq("id", user.id)
        .single();

      setUserProfile({
        username: profile?.username || null,
        created_at: profile?.created_at
      });
      
      if (profile?.username) {
        setNewUsername(profile.username);
      }
      
      const mockHistoryData: HistoryData = {
        id: user.id,
        email: user.email || "",
        username: profile?.username || null,
        presets_generated: 0,
        posts_created: 0,
        created_at: profile?.created_at
      };
      
      setHistoryData(mockHistoryData);
      
    } catch (error) {
      console.log("Error in account data fetch:", error);
    } finally {
      setLoadingAccount(false);
    }
  }

  async function fetchPreferencesData() {
    if (!user) return;
    
    try {
      setLoadingPreferences(true);
      const { data } = await supabase
        .from("users")
        .select("generation_preferences")
        .eq("id", user.id)
        .single();

      setGenerationPreferences(data?.generation_preferences || "");
    } catch (error) {
      console.log("Error fetching preferences:", error);
    } finally {
      setLoadingPreferences(false);
    }
  }

  async function fetchPresetsData() {
    if (!user) return;
    
    try {
      setLoadingPresets(true);
      // Replace this with supabase query wjen ready
        { id: '1', uuid: 'abc123-def456-ghi789', name: 'Rock Preset', created_at: '2024-01-15' },
        { id: '2', uuid: 'jkl012-mno345-pqr678', name: 'Jazz Preset', created_at: '2024-01-20' },
        { id: '3', uuid: 'stu901-vwx234-yza567', name: 'Electronic Preset', created_at: '2024-01-25' },
      ];
      
      setPresets(mockPresets);
      
    } catch (error) {
      console.log("Error fetching presets:", error);
      setPresets([]);
    } finally {
      setLoadingPresets(false);
    }
  }

  async function fetchPostsData() {
    if (!user) return;
    
    try {
      setLoadingPosts(true);
      // Replace this with supabase query wjen ready
      const mockPosts: PostData[] = [
        { id: '1', uuid: 'bcd234-efg567-hij890', title: 'My First Post', created_at: '2024-01-10' },
        { id: '2', uuid: 'klm123-nop456-qrs789', title: 'Music Theory Discussion', created_at: '2024-01-18' },
      ];
      
      setPosts(mockPosts);
      
    } catch (error) {
      console.log("Error fetching posts:", error);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function savePreferences() {
    if (!user) return;
    
    try {
      setSavingPreferences(true);
      const { error } = await supabase
        .from("users")
        .update({ generation_preferences: generationPreferences.trim() })
        .eq("id", user.id);

      if (error) throw error;
      
    } catch (error) {
      console.log("Failed to save preferences:", error);
    } finally {
      setSavingPreferences(false);
    }
  }

  async function saveUsername() {
    if (!user || !newUsername.trim()) return;
    
    try {
      setSavingUsername(true);
      const { error } = await supabase
        .from("users")
        .update({ username: newUsername.trim() })
        .eq("id", user.id);

      if (error) throw error;

      // Update user profile data
      setUserProfile(prev => prev ? {
        ...prev,
        username: newUsername.trim()
      } : {
        username: newUsername.trim(),
        created_at: undefined
      });
      
      setEditingUsername(false);
    } catch (error) {
      console.log("Failed to update username:", error);
    } finally {
      setSavingUsername(false);
    }
  }

  const handleAccountClick = async () => {
    if (!showAccountPopup) {
      await fetchAccountData();
    }
    setShowAccountPopup(!showAccountPopup);
  };

  const handlePreferencesClick = async () => {
    if (!showPreferencesPopup) {
      await fetchPreferencesData();
    }
    setShowPreferencesPopup(!showPreferencesPopup);
  };

  const handleHistoryClick = async () => {
    if (!showHistoryPopup) {
      await fetchPresetsData();
    }
    setShowHistoryPopup(!showHistoryPopup);
  };

  const handlePostsClick = async () => {
    if (!showPostsPopup) {
      await fetchPostsData();
    }
    setShowPostsPopup(!showPostsPopup);
  };

  const closeAccountPopup = () => {
    setShowAccountPopup(false);
  };

  const closePreferencesPopup = () => {
    setShowPreferencesPopup(false);
  };

  const closeHistoryPopup = () => {
    setShowHistoryPopup(false);
  };

  const closePostsPopup = () => {
    setShowPostsPopup(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not available";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  if (!user) return <div />;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 h-16 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-6 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div
          className="cursor-pointer text-xl font-extrabold"
          onClick={() => router.push("/")}
        >
          Resonance
        </div>

        <button
          onClick={() => router.push("/generate")}
          className="text-sm font-semibold hover:underline"
        >
          Generate
        </button>
      </nav>

      {/* BACKGROUND */}
      <div
        className="relative flex-1"
        style={{
          backgroundImage: "url('/bwire.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* ACCOUNT INFORMATION */}
        {showAccountPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={closeAccountPopup}
          >
            <div 
              className="relative rounded-3xl max-w-md w-full mx-4 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div 
                className="bg-black px-12 pt-12 pb-8"
                style={{
                  borderTopLeftRadius: '1.5rem',
                  borderTopRightRadius: '1.5rem',
                }}
              >
                <button
                  onClick={closeAccountPopup}
                  className="absolute top-6 right-6 text-3xl text-white/90 hover:text-white transition-colors duration-200"
                >
                  ×
                </button>
                  <div className="text-center mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    Account Information
                  </span>
                </div>
              </div>
              <div 
                className="px-12 pb-12"
                style={{
                  backgroundImage: "url('/bwire2.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderBottomLeftRadius: '1.5rem',
                  borderBottomRightRadius: '1.5rem',
                }}
              >
                {loadingAccount ? (
                  <div className="text-center pt-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/70 mb-4"></div>
                    <div className="text-center">
                      <span className="text-xl font-semibold text-white">
                        Loading account information...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
                      <div className="text-lg font-bold text-zinc-800 mb-3">
                        Change Username
                      </div>
                      {editingUsername ? (
                        <div className="flex flex-col gap-3">
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-300 bg-zinc-50 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
                            placeholder="Enter new username"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={saveUsername}
                              disabled={savingUsername || !newUsername.trim()}
                              className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                            >
                              {savingUsername ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingUsername(false);
                                setNewUsername(userProfile?.username || "");
                              }}
                              className="flex-1 px-4 py-3 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-semibold transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="text-xl text-zinc-700 font-medium">
                            {userProfile?.username || user.user_metadata?.username || user.email?.split('@')[0] || "Not set"}
                          </div>
                          <button
                            onClick={() => setEditingUsername(true)}
                            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white font-semibold transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                  
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
                      <div className="text-lg font-bold text-zinc-800 mb-3">
                        Email
                      </div>
                      <div className="text-xl text-zinc-700 font-medium">
                        {user.email}
                      </div>
                    </div>
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
                      <div className="text-lg font-bold text-zinc-800 mb-3">
                        Member Since
                      </div>
                      <div className="text-xl text-zinc-700 font-medium">
                        {formatDate(userProfile?.created_at)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PREFERENCES */}
        {showPreferencesPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={closePreferencesPopup}
          >
            <div 
              className="relative rounded-3xl max-w-md w-full mx-4 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div 
                className="bg-black px-12 pt-12 pb-8"
                style={{
                  borderTopLeftRadius: '1.5rem',
                  borderTopRightRadius: '1.5rem',
                }}
              >
                {/* CLOSE */}
                <button
                  onClick={closePreferencesPopup}
                  className="absolute top-6 right-6 text-3xl text-white/90 hover:text-white transition-colors duration-200"
                >
                  ×
                </button>
                
                {/* TITLE */}
                <div className="text-center mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    Preferences
                  </span>
                </div>
                
                <div className="text-center mb-2">
                  <span className="text-lg font-bold text-white">
                    SEPARATE ALL GENRES USING COMMAS
                  </span>
                </div>
              </div>
              
              <div 
                className="px-12 pb-12"
                style={{
                  backgroundImage: "url('/bwire2.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderBottomLeftRadius: '1.5rem',
                  borderBottomRightRadius: '1.5rem',
                }}
              >
                {loadingPreferences ? (
                  <div className="text-center pt-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/70 mb-4"></div>
                    <div className="text-center">
                      <span className="text-xl font-semibold text-white">
                        Loading preferences...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    <div>
                      <textarea
                        value={generationPreferences}
                        onChange={(e) => setGenerationPreferences(e.target.value)}
                        className="w-full h-40 px-4 py-3 rounded-xl border border-zinc-300 bg-zinc-50 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none resize-none"
                        placeholder="Rock, Jazz, Electronic, Ambient..."
                      />
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={savePreferences}
                          disabled={savingPreferences}
                          className="rounded-xl border border-zinc-300 bg-white px-8 py-3 text-base font-medium text-black transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingPreferences ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY  */}
        {showHistoryPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={closeHistoryPopup}
          >
            <div 
              className="relative rounded-3xl max-w-2xl w-full mx-4 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div 
                className="bg-black px-12 pt-12 pb-8"
                style={{
                  borderTopLeftRadius: '1.5rem',
                  borderTopRightRadius: '1.5rem',
                }}
              >
                <button
                  onClick={closeHistoryPopup}
                  className="absolute top-6 right-6 text-3xl text-white/90 hover:text-white transition-colors duration-200"
                >
                  ×
                </button>
                <div className="text-center mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    Preset History
                  </span>
                </div>
              </div>
              <div 
                className="px-12 pb-12"
                style={{
                  backgroundImage: "url('/bwire2.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderBottomLeftRadius: '1.5rem',
                  borderBottomRightRadius: '1.5rem',
                }}
              >
                {loadingPresets ? (
                  <div className="text-center pt-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/70 mb-4"></div>
                    <div className="text-center">
                      <span className="text-xl font-semibold text-white">
                        Loading presets...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    {presets.length === 0 ? (
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-lg">
                        <div className="text-center">
                          <span className="text-2xl font-bold text-zinc-800">
                            No presets found
                          </span>
                          <p className="text-lg text-zinc-600 mt-2">
                            You haven't created any presets yet.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {presets.map((preset) => (
                          <div 
                            key={preset.id}
                            className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="text-lg font-bold text-zinc-800">
                                  {preset.name}
                                </div>
                                <div className="text-sm text-zinc-600 font-mono mt-1">
                                  UUID: {preset.uuid}
                                </div>
                              </div>
                              <div className="text-sm text-zinc-500">
                                Created: {formatDate(preset.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* POSTS  */}
        {showPostsPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={closePostsPopup}
          >
            <div 
              className="relative rounded-3xl max-w-2xl w-full mx-4 overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                border: "2px solid rgba(255, 255, 255, 0.3)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div 
                className="bg-black px-12 pt-12 pb-8"
                style={{
                  borderTopLeftRadius: '1.5rem',
                  borderTopRightRadius: '1.5rem',
                }}
              >
                <button
                  onClick={closePostsPopup}
                  className="absolute top-6 right-6 text-3xl text-white/90 hover:text-white transition-colors duration-200"
                >
                  ×
                </button>
                <div className="text-center mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    Your Posts
                  </span>
                </div>
              </div>
              <div 
                className="px-12 pb-12"
                style={{
                  backgroundImage: "url('/bwire2.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  borderBottomLeftRadius: '1.5rem',
                  borderBottomRightRadius: '1.5rem',
                }}
              >
                {loadingPosts ? (
                  <div className="text-center pt-4">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white/70 mb-4"></div>
                    <div className="text-center">
                      <span className="text-xl font-semibold text-white">
                        Loading posts...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    {posts.length === 0 ? (
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-lg">
                        <div className="text-center">
                          <span className="text-2xl font-bold text-zinc-800">
                            No posts found
                          </span>
                          <p className="text-lg text-zinc-600 mt-2">
                            You haven't created any posts yet.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {posts.map((post) => (
                          <div 
                            key={post.id}
                            className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="text-lg font-bold text-zinc-800">
                                  {post.title}
                                </div>
                                <div className="text-sm text-zinc-600 font-mono mt-1">
                                  UUID: {post.uuid}
                                </div>
                              </div>
                              <div className="text-sm text-zinc-500">
                                Created: {formatDate(post.created_at)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center items-start pt-16">
          <div className="h-full w-[420px] p-8 flex flex-col items-center">

            {/* TITLE  */}
            <div className="w-full bg-black/50 backdrop-blur-sm py-4 mb-2 rounded-lg">
              <h1 className="text-6xl font-extrabold text-white text-center">
                My Profile
              </h1>
            </div>

            {/* USERNAME */}
            <div className="w-full bg-black/50 backdrop-blur-sm py-3 mb-10 rounded-lg">
              <h2 className="text-3xl font-bold text-white text-center">
                {user.user_metadata?.username ?? user.email?.split("@")[0]}
              </h2>
            </div>

            {/* PROFILE PICTURE  */}
            <div className="flex flex-col items-center mb-12">
              <img
                src={
                  profileUrl ??
                  "https://ui-avatars.com/api/?name=User&background=ccc"
                }
                className="h-44 w-44 rounded-full object-cover border mb-5 border-white/30 cursor-pointer hover:opacity-80 transition"
                onClick={() => fileInputRef.current?.click()}
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={uploadProfilePicture}
              />

              {uploading && (
                <p className="text-white text-sm opacity-80 mt-2">
                  Uploading…
                </p>
              )}
            </div>

            {/*HISTORY AND ACCOUNT INFORMATION */}
            <div className="mb-10 grid grid-cols-2 gap-6 w-full">
              <button
                onClick={handleHistoryClick}
                className="
                  group relative rounded-3xl px-8 py-6
                  border-2 border-white/30
                  backdrop-invert mix-blend-difference
                  transition-all duration-300
                  active:scale-95
                "
              >
                <span className="text-2xl font-extrabold text-center block group-hover:backdrop-invert group-hover:mix-blend-difference">
                  History
                </span>
              </button>
              <button
                onClick={handleAccountClick}
                className="
                  group relative rounded-3xl px-8 py-6
                  border-2 border-white/30
                  backdrop-invert mix-blend-difference
                  transition-all duration-300
                  active:scale-95
                "
              >
                <span className="text-xl font-extrabold text-center block leading-tight group-hover:backdrop-invert group-hover:mix-blend-difference">
                  Account Information
                </span>
              </button>
            </div>

            {/* PREFERENCES AND POSTS */}
            <div className="flex flex-col gap-6 w-full">
              <button
                onClick={handlePreferencesClick}
                className="
                  group rounded-2xl border px-8 py-6
                  backdrop-invert mix-blend-difference
                  transition-all duration-300
                  active:scale-95
                "
              >
                <span className="text-xl font-extrabold text-center block group-hover:backdrop-invert group-hover:mix-blend-difference">
                  Preferences
                </span>
              </button>
              <button
                onClick={handlePostsClick}
                className="
                  group rounded-2xl border px-8 py-6
                  backdrop-invert mix-blend-difference
                  transition-all duration-300
                  active:scale-95
                "
              >
                <span className="text-xl font-extrabold text-center block group-hover:backdrop-invert group-hover:mix-blend-difference">
                  Posts
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}