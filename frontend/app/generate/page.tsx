"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

type PresetResult = {
  id: string;
  title: string;
  score: number;
  preview_object_key: string | null;
  preset_object_key?: string;
};

interface Message {
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  presets?: PresetResult[];
  error?: boolean;
  /** Set after the user picks one of the preset cards for modification */
  selectedPresetId?: string;
  /** When true, the preset card grid collapses to a compact summary chip */
  presetsConsumed?: boolean;
  /** Parsed parameter changes returned by /api/modify-preset */
  presetChanges?: {
    changes: Record<string, number | string>;
    explanation: string;
    /** Full modified .vital JSON for download */
    modifiedData?: Record<string, unknown>;
    /** Preset name, used for the download filename */
    presetName?: string;
    /** Base64-encoded WAV audio preview */
    audioB64?: string;
  };
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

  /** The preset the user has clicked on, pending a modification request */
  const [selectedPreset, setSelectedPreset] = useState<{
    messageIndex: number;
    preset: PresetResult;
  } | null>(null);

  /** Current in-memory .vital preset data, updated after each modification iteration */
  const [currentPresetData, setCurrentPresetData] = useState<Record<string, unknown> | null>(null);
  /** Display name for the preset currently being modified (persists across iterations) */
  const [currentPresetName, setCurrentPresetName] = useState<string | null>(null);

  // Use env vars for bucket URLs
  const PRESETS_BUCKET = process.env.NEXT_PUBLIC_PRESETS_BUCKET;
  const PREVIEWS_BUCKET = process.env.NEXT_PUBLIC_PREVIEWS_BUCKET;

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  
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

    const query = inputValue.trim();
    setInputValue("");

    // -----------------------------------------------------------------------
    // MODIFICATION FLOW — user has selected a preset OR is iterating on one
    // -----------------------------------------------------------------------
    if (selectedPreset || currentPresetData) {
      const isFirstModification = selectedPreset !== null;
      const presetName = isFirstModification
        ? selectedPreset!.preset.title
        : currentPresetName ?? "preset";
      const messageIndex = selectedPreset?.messageIndex;

      const userMessage: Message = { role: "user", content: query };
      setMessages((prev) => [...prev, userMessage]);

      // Collapse the original preset card grid on first modification
      if (isFirstModification && messageIndex !== undefined) {
        setMessages((prev) =>
          prev.map((msg, i) =>
            i === messageIndex
              ? { ...msg, presetsConsumed: true, selectedPresetId: selectedPreset!.preset.id }
              : msg
          )
        );
      }

      setSelectedPreset(null);

      // Show loading bubble
      setMessages((prev) => [...prev, { role: "assistant", content: "", isLoading: true }]);

      try {
        const requestBody = isFirstModification
          ? {
              preset_id: selectedPreset!.preset.id,
              description: query,
              context: `The user is modifying an existing preset called "${presetName}".`,
            }
          : {
              preset_data: currentPresetData,
              description: query,
              context: `The user is further modifying a preset called "${presetName}".`,
            };

        const modifyRes = await fetch(`${API_BASE_URL}/api/modify-preset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!modifyRes.ok) {
          const body = await modifyRes.text().catch(() => "(no body)");
          console.error(`/api/modify-preset returned ${modifyRes.status}. Body: ${body}`);
          throw new Error(`Modification error ${modifyRes.status}: ${body}`);
        }

        const modifyData = await modifyRes.json();
        const { modified_preset, changes, explanation, audio_b64 } = modifyData as {
          modified_preset: Record<string, unknown>;
          changes: Record<string, number | string>;
          explanation: string;
          audio_b64: string | null;
        };

        // Persist the modified preset for future iterations
        setCurrentPresetData(modified_preset);
        if (isFirstModification) setCurrentPresetName(presetName);

        setMessages((prev) => {
          const withoutLoading = prev.filter((msg) => !msg.isLoading);
          return [
            ...withoutLoading,
            {
              role: "assistant",
              content: explanation,
              presetChanges: {
                changes,
                explanation,
                modifiedData: modified_preset,
                presetName,
                audioB64: audio_b64 ?? undefined,
              },
            },
          ];
        });
      } catch (error) {
        const isNetworkError = error instanceof TypeError;
        const detail = error instanceof Error ? error.message : String(error);
        console.error("Modification error:", detail);
        setMessages((prev) => {
          const withoutLoading = prev.filter((msg) => !msg.isLoading);
          return [
            ...withoutLoading,
            {
              role: "assistant",
              content: isNetworkError
                ? `Couldn't reach the backend. Is the server running on ${API_BASE_URL}?`
                : `The modification failed: ${detail}`,
              error: true,
            },
          ];
        });
      }
      return;
    }

    // -----------------------------------------------------------------------
    // INITIAL RETRIEVAL FLOW — user has typed a new sound description
    // -----------------------------------------------------------------------
    const userMessage: Message = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setShowChat(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "", isLoading: true }]);

    try {
      const retrieveRes = await fetch(`${API_BASE_URL}/api/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, k: 5 }),
      });

      if (!retrieveRes.ok) {
        const body = await retrieveRes.text().catch(() => "(no body)");
        throw new Error(`CLAP retrieval failed (${retrieveRes.status}): ${body}`);
      }

      const retrieveData = await retrieveRes.json();
      const results: PresetResult[] = retrieveData.results ?? [];

      setMessages((prev) => {
        const withoutLoading = prev.filter((msg) => !msg.isLoading);
        return [
          ...withoutLoading,
          {
            role: "assistant",
            content:
              results.length > 0
                ? "Here are the top presets matching your description. Click one to select it, then describe how you'd like to modify it:"
                : `No presets found matching "${query}". Try a different description!`,
            presets: results.length > 0 ? results : undefined,
          },
        ];
      });
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => {
        const withoutLoading = prev.filter((msg) => !msg.isLoading);
        return [
          ...withoutLoading,
          {
            role: "assistant",
            content: `Sorry, something went wrong. Make sure the server is running on ${API_BASE_URL}`,
            error: true,
          },
        ];
      });
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-zinc-50 font-sans dark:bg-black">
      {/* Navbar */}
      <nav className="flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 sm:flex-nowrap sm:justify-between sm:gap-4 sm:px-6 sm:py-4 dark:border-zinc-800 dark:bg-black">
        {/* Logo/Brand */}
        <Link href="/" className="text-xl font-semibold text-black dark:text-white hover:opacity-80 transition">
          Resonance
        </Link>
        
        {/* Search Box */}
        <div className="order-3 w-full sm:order-2 sm:mx-6 sm:block sm:max-w-2xl sm:flex-1">
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
          />
        </div>
        
        {/* Browse and Profile */}
        <div className="relative order-2 ml-auto flex items-center gap-4 sm:order-3 sm:ml-0 sm:gap-6">
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
            <div className="fixed left-3 right-3 top-16 z-50 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-900/10 sm:left-auto sm:right-6 sm:w-80 dark:border-zinc-800 dark:bg-zinc-900">
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
      <main className="flex w-full flex-1 items-start justify-center gap-4 overflow-hidden bg-white px-4 pt-6 sm:px-6 sm:pt-8 dark:bg-black lg:gap-8">
        {/* Left Robot Image */}
        <div className="hidden h-full justify-end lg:flex" style={{ width: '260px' }}>
          <div className="pt-16">
          <div className="flex justify-end pr-8 xl:pr-20">
          <Image
            className="dark:invert scale-y-[-4.5]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          <div className="flex justify-end pr-8 xl:pr-20">
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
        <div className="flex min-w-0 w-full max-w-2xl flex-col">
          {!showChat ? (
            // Initial hero view
            <div className="flex flex-col items-center gap-6 text-center sm:gap-8">
              <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-6xl md:text-7xl dark:text-zinc-50">
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
            <div className="flex h-full min-h-0 flex-col" style={{ height: 'calc(100vh - 170px)' }}>
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {message.isLoading ? (
                      <div className="max-w-[92%] rounded-lg border border-black bg-white px-4 py-2 text-black sm:max-w-[80%] dark:border-white dark:bg-black dark:text-white">
                        <div className="flex gap-1 items-center">
                          <div className="bouncing-dot" style={{ animationDelay: '0s' }}></div>
                          <div className="bouncing-dot" style={{ animationDelay: '0.2s' }}></div>
                          <div className="bouncing-dot" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`max-w-[92%] rounded-lg border px-4 py-2 sm:max-w-[80%] ${
                          message.role === "user"
                            ? "bg-black text-white border-white dark:bg-white dark:text-black dark:border-black"
                            : "bg-white text-black border-black dark:bg-black dark:text-white dark:border-white"
                        }`}
                      >
                        <div className={message.error ? "text-red-600 dark:text-red-400" : ""}>
                          {message.content}
                        </div>
                        {message.presetChanges && (
                          <div className="mt-3 space-y-2">
                            {message.presetChanges.audioB64 ? (
                              <audio
                                controls
                                className="w-full"
                                style={{ height: '40px' }}
                                src={`data:audio/wav;base64,${message.presetChanges.audioB64}`}
                              >
                                Your browser does not support the audio element.
                              </audio>
                            ) : (
                              <div className="text-xs italic opacity-50">No preview available</div>
                            )}
                            {message.presetChanges.modifiedData && (
                              <button
                                onClick={() => {
                                  const blob = new Blob(
                                    [JSON.stringify(message.presetChanges!.modifiedData, null, 2)],
                                    { type: "application/json" }
                                  );
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${
                                    (message.presetChanges!.presetName || "preset").replace(/\s+/g, "_")
                                  }_modified.vital`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                }}
                                className="flex w-full items-center justify-center gap-1.5 rounded border border-black px-3 py-1.5 text-xs font-medium transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
                              >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download{message.presetChanges.presetName ? ` "${message.presetChanges.presetName}"` : " Modified Preset"}
                              </button>
                            )}
                          </div>
                        )}
                        {message.presets && message.presets.length > 0 && (
                          <>
                            {message.presetsConsumed ? (
                              // Compact chip shown after user submits a modification
                              <div className="mt-2 flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                <svg className="w-3 h-3 shrink-0 text-cyan-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>
                                  Selected:{" "}
                                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                    {message.presets.find((p) => p.id === message.selectedPresetId)?.title ?? "Unknown"}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              // Selectable preset card grid
                              <div className="mt-2 space-y-2">
                                {message.presets.map((preset, presetIndex) => {
                                  const isSelected =
                                    selectedPreset?.messageIndex === index &&
                                    selectedPreset.preset.id === preset.id;
                                  const anySelected = selectedPreset?.messageIndex === index;
                                  return (
                                    <div
                                      key={presetIndex}
                                      onClick={() => setSelectedPreset({ messageIndex: index, preset })}
                                      className={`cursor-pointer rounded border-t border-black pt-2 mt-2 transition dark:border-white ${
                                        isSelected
                                          ? "ring-2 ring-cyan-400"
                                          : anySelected
                                          ? "opacity-40"
                                          : "hover:opacity-80"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex-1">
                                          <div className="font-medium text-sm text-black dark:text-white flex items-center gap-1.5">
                                            {isSelected && (
                                              <svg className="w-3 h-3 shrink-0 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                            )}
                                            {preset.title}
                                          </div>
                                          <div className="text-xs opacity-60 mt-0.5">
                                            {(preset.score * 100).toFixed(0)}% match
                                          </div>
                                        </div>
                                        <a
                                          href={`${PRESETS_BUCKET}/${preset.preset_object_key || preset.id}`}
                                          download
                                          onClick={(e) => e.stopPropagation()}
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
                                            onClick={(e) => e.stopPropagation()}
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
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input form */}
              <div className="space-y-2">
                {(selectedPreset || currentPresetData) && (
                  <div className="flex items-center justify-between rounded-lg border border-cyan-400 bg-cyan-50 px-3 py-1.5 text-xs dark:bg-cyan-950 dark:border-cyan-600">
                    <span className="text-cyan-700 dark:text-cyan-300">
                      Modifying:{" "}
                      <span className="font-semibold">
                        {selectedPreset?.preset.title ?? currentPresetName}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreset(null);
                        setCurrentPresetData(null);
                        setCurrentPresetName(null);
                      }}
                      className="ml-2 text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-200 transition"
                      aria-label="Cancel modification"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      selectedPreset
                        ? `Describe how to modify "${selectedPreset.preset.title}"...`
                        : currentPresetData
                        ? `Describe further changes to "${currentPresetName}"...`
                        : "Type your message..."
                    }
                    className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-6 py-3 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:text-base dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                  >
                    {selectedPreset || currentPresetData ? "Modify" : "Send"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Right Robot Image (Mirrored) */}
        <div className="hidden h-full justify-start lg:flex" style={{ width: '260px' }}>
          <div className="pt-16">
          <div className="flex justify-start pl-8 xl:pl-20">
          <Image
            className="dark:invert scale-y-[-4.5] scale-x-[-1]"
            src="/robot-black.svg"
            alt="SynthGPT logo"
            width={120}
            height={120}
            priority
          />
          </div>
          <div className="flex justify-start pl-8 xl:pl-20">
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
