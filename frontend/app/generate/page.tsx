"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

interface Message {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  presets?: Array<{
    id: string;
    title: string;
    score: number;
    preview_object_key: string | null;
    preset_object_key?: string;
  }>;
  error?: boolean;
}

const placeholderExamples = [
  "Give me a powerful bass for a hip-hop track",
  "I want an energetic lead",
  "Generate a heavenly violin preset",
  "Create a warm pad for ambient music",
  "I need a punchy synth bass",
  "Make a dreamy bell sound",
  "Generate an aggressive synth lead for EDM",
  "Create a soft piano-like texture",
];

export default function GeneratePage() {
  const [placeholder] = useState(() => 
    typeof window !== "undefined" 
      ? placeholderExamples[Math.floor(Math.random() * placeholderExamples.length)]
      : ""
  );
  const [user, setUser] = useState<User | null>(null);
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Chat state
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use env vars for bucket URLs
  const PRESETS_BUCKET = process.env.NEXT_PUBLIC_PRESETS_BUCKET;
  const PREVIEWS_BUCKET = process.env.NEXT_PUBLIC_PREVIEWS_BUCKET;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = { role: "user", content: inputValue };
    const query = inputValue;
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setShowChat(true);

    // Add loading message
    const loadingMessage: Message = { role: "assistant", content: "", isLoading: true };
    setMessages((prev) => [...prev, loadingMessage]);

    // Call the /api/retrieve endpoint
    try {
      const res = await fetch("http://localhost:8000/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 5 }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch presets");
      }

      const data = await res.json();
      const results = data.results || [];
      
      // Debug: log the results to see what data we're getting
      console.log("Retrieved presets:", results);

      setMessages((prev) => {
        const withoutLoading = prev.filter((msg) => !msg.isLoading);
        const assistantMessage: Message = {
          role: "assistant",
          content: results.length > 0 
            ? `Here are the top ${results.length} preset${results.length !== 1 ? 's' : ''} that match your description:`
            : `No presets found matching "${query}". Try a different description!`,
          presets: results.length > 0 ? results : undefined,
        };
        return [...withoutLoading, assistantMessage];
      });
    } catch (error) {
      console.error("Error fetching presets:", error);
      setMessages((prev) => {
        const withoutLoading = prev.filter((msg) => !msg.isLoading);
        const assistantMessage: Message = {
          role: "assistant",
          content: "Sorry, I couldn't connect to the backend. Make sure the server is running on http://localhost:8000",
          error: true,
        };
        return [...withoutLoading, assistantMessage];
      });
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans dark:bg-black overflow-hidden">
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
            placeholder="Search..."
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
          />
        </div>
        
        {/* Browse and Profile */}
        <div className="relative flex items-center gap-6">
          <Link href="/browse" className="text-sm font-medium text-black transition-colors hover:text-zinc-600 hover:underline dark:text-white dark:hover:text-zinc-300 cursor-pointer">
            Browse
          </Link>
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
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                        Signed in as <span className="font-medium">{user.email}</span>
                      </div>
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

      {/* Main Content */}
      <main className="flex flex-1 w-full items-start justify-center bg-white dark:bg-black pt-8 overflow-hidden" style={{ minWidth: '1400px' }}>
        {/* Left Robot Image */}
        <div className="flex justify-end h-full" style={{ width: '300px', marginRight: '80px' }}>
          <div className="pt-16">
          <div className="flex justify-end pr-20">
          <Image
            className="dark:invert scale-y-[-4.5]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          <div className="flex justify-end pr-20">
          <Image
            className="dark:invert scale-y-[4.5]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          </div>
        </div>
        
        {/* Center Content */}
        <div className="flex flex-col w-full" style={{ maxWidth: '600px' }}>
          {!showChat ? (
            // Initial hero view
            <div className="flex flex-col items-center gap-8 text-center">
              <h1 className="text-7xl font-semibold tracking-tight text-black dark:text-zinc-50">
                Resonance
              </h1>
              <form onSubmit={handleSubmit} className="w-full">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-6 py-3 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
                />
              </form>
            </div>
          ) : (
            // Chat view
            <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 140px)' }}>
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.isLoading ? (
                      <div className="rounded-lg bg-white border border-black px-4 py-2 text-black dark:bg-black dark:border-white dark:text-white max-w-[80%]">
                        <div className="flex gap-1 items-center">
                          <div className="bouncing-dot" style={{ animationDelay: '0s' }}></div>
                          <div className="bouncing-dot" style={{ animationDelay: '0.2s' }}></div>
                          <div className="bouncing-dot" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg px-4 py-2 max-w-[80%] border ${
                          message.role === "user"
                            ? "bg-black text-white border-white dark:bg-white dark:text-black dark:border-black"
                            : "bg-white text-black border-black dark:bg-black dark:text-white dark:border-white"
                        }`}
                      >
                        <div className={message.error ? "text-red-600 dark:text-red-400" : ""}>
                          {message.content}
                        </div>
                        {message.presets && message.presets.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.presets.map((preset, presetIndex) => (
                              <div
                                key={presetIndex}
                                className="border-t border-black dark:border-white pt-2 mt-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-black dark:text-white">
                                      {preset.title}
                                    </div>
                                    <div className="text-xs opacity-60 mt-0.5">
                                      {(preset.score * 100).toFixed(0)}% match
                                    </div>
                                  </div>
                                  <a
                                    href={`${PRESETS_BUCKET}/${preset.preset_object_key || preset.id}`}
                                    download
                                    className="px-2 py-1 border border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition"
                                    title="Download"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </a>
                                </div>
                                {preset.preview_object_key ? (
                                  <div className="mt-1.5">
                                    <audio
                                      controls
                                      className="w-full"
                                      style={{ height: '40px' }}
                                      src={`${PREVIEWS_BUCKET}/${preset.preview_object_key}`}
                                    >
                                      Your browser does not support the audio element.
                                    </audio>
                                  </div>
                                ) : (
                                  <div className="text-xs opacity-50 italic mt-1">
                                    No preview available
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input form */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-6 py-3 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="rounded-xl bg-white border border-zinc-300 px-6 py-3 text-base font-medium text-black transition hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-700"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Robot Image (Mirrored) */}
        <div className="flex justify-start h-full" style={{ width: '300px', marginLeft: '80px' }}>
          <div className="pt-16">
          <div className="flex justify-start pl-20">
          <Image
            className="dark:invert scale-y-[-4.5] scale-x-[-1]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          <div className="flex justify-start pl-20">
          <Image
            className="dark:invert scale-y-[4.5] scale-x-[-1]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          </div>
        </div>
        
      </main>
    </div>
  );
}