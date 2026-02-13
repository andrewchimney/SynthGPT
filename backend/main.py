"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface HistoryData {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  presets_generated: number;
  posts_created: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

      const { data: profile } = await supabase
        .from("users")
        .select("profile_picture, username")
        .eq("id", currentUser.id)
        .single();

      if (profile?.profile_picture) {
        const { data } = supabase.storage
          .from("profile_pictures")
          .getPublicUrl(profile.profile_picture);
        setProfileUrl(data.publicUrl);
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

  async function fetchHistoryData() {
    if (!user) return;
    
    try {
      setLoadingHistory(true);
      const response = await fetch(`/api/user/${user.id}/history`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch history data");
      }
      
      const data = await response.json();
      
      // Check if we got an error response
      if (data.error) {
        console.error("Error fetching history:", data.error);
        // Set default values if API returns error
        setHistoryData({
          id: user.id,
          email: user.email || "",
          username: user.user_metadata?.username || null,
          full_name: user.user_metadata?.full_name || null,
          presets_generated: 0,
          posts_created: 0
        });
      } else {
        setHistoryData(data);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      // Set default values on error
      setHistoryData({
        id: user.id,
        email: user.email || "",
        username: user.user_metadata?.username || null,
        full_name: user.user_metadata?.full_name || null,
        presets_generated: 0,
        posts_created: 0
      });
    } finally {
      setLoadingHistory(false);
    }
  }

  const handleHistoryClick = async () => {
    if (!showHistoryPopup) {
      await fetchHistoryData();
    }
    setShowHistoryPopup(!showHistoryPopup);
  };

  const closeHistoryPopup = () => {
    setShowHistoryPopup(false);
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
        {/* HISTORY POPUP OVERLAY */}
        {showHistoryPopup && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={closeHistoryPopup}
          >
            <div 
              className="relative rounded-3xl p-12 max-w-md w-full mx-4 overflow-hidden border-2 border-white/30"
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundImage: "url('/bwire2.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <button
                onClick={closeHistoryPopup}
                className="absolute top-4 right-4 text-2xl text-white hover:text-gray-300"
              >
                ×
              </button>
              
              <h2 className="text-3xl font-extrabold mb-8 text-center text-white backdrop-invert mix-blend-difference">
                History
              </h2>
              
              {loadingHistory ? (
                <div className="text-center text-white backdrop-invert mix-blend-difference">
                  Loading...
                </div>
              ) : historyData ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-6xl font-bold mb-2 text-white backdrop-invert mix-blend-difference">
                      {historyData.presets_generated}
                    </div>
                    <div className="text-xl font-semibold text-white/90 backdrop-invert mix-blend-difference">
                      Presets Generated
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-6xl font-bold mb-2 text-white backdrop-invert mix-blend-difference">
                      {historyData.posts_created}
                    </div>
                    <div className="text-xl font-semibold text-white/90 backdrop-invert mix-blend-difference">
                      Posts Created
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/30 text-center">
                    <div className="text-white/80 backdrop-invert mix-blend-difference">
                      User: {historyData.username || historyData.email.split('@')[0]}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-white backdrop-invert mix-blend-difference">
                  Failed to load history data
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center items-start pt-16">
          <div className="h-full w-[420px] p-8 flex flex-col items-center">

            <h1 className="text-6xl font-extrabold mb-2 text-white backdrop-invert mix-blend-difference">
              My Profile
            </h1>

            <h2 className="text-3xl font-bold mb-10 text-white backdrop-invert mix-blend-difference">
              {user.user_metadata?.username ?? user.email?.split("@")[0]}
            </h2>

            {/* PROFILE PICTURE */}
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

            {/* TOP BUTTONS */}
            <div className="mb-10 grid grid-cols-2 gap-6 w-full">
              {["History", "Account Information"].map((text) => (
                <button
                  key={text}
                  onClick={text === "History" ? handleHistoryClick : undefined}
                  className="
                    group relative rounded-3xl px-8 py-6
                    border-2 border-white/30
                    transition-all duration-300
                    active:scale-95
                    hover:border-white/60
                  "
                  style={{
                    backgroundImage: "url('/bwire2.jpg')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <span
                    className={`
                      font-extrabold text-center block
                      ${text === "Account Information"
                        ? "text-xl leading-tight"
                        : "text-2xl"}
                      backdrop-invert mix-blend-difference
                    `}
                  >
                    {text}
                  </span>
                </button>
              ))}
            </div>

            {/* PREFERENCES + POSTS */}
            <div className="flex flex-col gap-6 w-full">
              {["Preferences", "Posts"].map((text) => (
                <button
                  key={text}
                  className="
                    group rounded-2xl border px-8 py-6
                    transition-all duration-300
                    active:scale-95
                    hover:border-white/60
                    border-white/30
                  "
                  style={{
                    backgroundImage: "url('/bwire2.jpg')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <span
                    className="
                      text-xl font-extrabold text-center block
                      backdrop-invert mix-blend-difference
                    "
                  >
                    {text}
                  </span>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}