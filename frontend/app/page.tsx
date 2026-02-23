"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div 
      className="relative flex min-h-screen flex-col items-center justify-center bg-white dark:bg-black"
      style={{
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 30%',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Blur overlay for better text readability */}
      <div className="absolute inset-0 backdrop-blur-md"></div>
      
      <main className="relative z-10 flex flex-col items-center gap-6 px-6 py-10 text-center sm:gap-8 sm:px-8">
        <h1 className="text-5xl font-bold tracking-tight text-black dark:text-white sm:text-7xl md:text-8xl">
          Resonance
        </h1>
        <p className="max-w-2xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg md:text-xl">
          AI-powered synth preset discovery. Describe the sound you want, and we&apos;ll find the perfect presets for you.
        </p>
        <div className="mt-2 flex w-full max-w-md flex-col gap-3 sm:mt-4 sm:max-w-none sm:w-auto sm:flex-row sm:gap-4">
          <Link
            href="/generate"
            className="w-full border-2 border-black bg-black px-6 py-3 text-center text-base font-semibold text-white transition hover:bg-white hover:text-black dark:border-white dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
          >
            Start Generating
          </Link>
          <Link
            href="/browse"
            className="w-full border-2 border-black bg-white px-6 py-3 text-center text-base font-semibold text-black transition hover:bg-black hover:text-white dark:border-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
          >
            Browse Presets
          </Link>
        </div>
      </main>
    </div>
  );
}
