"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

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

export default function Home() {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    const randomPlaceholder = placeholderExamples[Math.floor(Math.random() * placeholderExamples.length)];
    setPlaceholder(randomPlaceholder);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-black">
        {/* Logo/Brand */}
        <div className="text-xl font-semibold text-black dark:text-white">
          Resonance
        </div>
        
        {/* Search Box */}
        <div className="flex-1 mx-8 max-w-2xl">
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
          />
        </div>
        
        {/* Generate and Profile */}
        <div className="flex items-center gap-6">
          <button className="text-sm font-medium text-black transition-colors hover:text-zinc-600 hover:underline dark:text-white dark:hover:text-zinc-300">
            Generate
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700">
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
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex flex-1 w-full items-start justify-center bg-white dark:bg-black px-8 pt-32 gap-24">
        {/* Left Robot Image */}
        <div className="flex-1 flex justify-end">
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
        <div className="flex flex-col items-center gap-8 text-center max-w-[30rem] w-full">
          <h1 className="text-7xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Resonance
          </h1>
          <div className="w-full">
            <input
              type="text"
              placeholder={placeholder}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-6 py-3 text-base text-black placeholder-zinc-500 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
            />
          </div>
        </div>

        {/* Right Robot Image (Mirrored) */}
        <div className="flex-1 flex justify-start">
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
