"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// This will allow users who already have an account to log in instead of signing up
// This will provide a quick path for existing users to access their account without having to go through the signup process
import LoginPanel from "@/app/components/Authentication/LoginPanel";  

export default function Page() {
  /**
   * State Management
   * - Tracks whether to show the login panel for existing users.
   * - If this is an existing user, display the LoginPanel as an alternative to signup.
   */
  const [showLoginPanel, setShowLoginPanel] = useState(false);

  // This will be for future use when we implement signup form state
  const router = useRouter();

  // Handlers

  // Placeholder: Signup handler to be implemented in the future
  // Implementation will include traditional email and password signup
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Signup Section */}

        {/* Page Title */}
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Create Account
        </h1>

        {/* Subtitle */}
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Join Resonance to share your synth presets with the community
        </p>

        {/* Placeholder: Signup Form */}
        {/*
          TODO: Implement signup form with:
            - Email input
            - Password input
            - Password confirmation
            - Terms of service checkbox
            - Sign up button
            - Error handling
         
        */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Signup form coming soon...
          </p>
        </div>

        {/* Login Options for Existing Users */}
        {/* Visual Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-zinc-50 dark:bg-black text-zinc-500 dark:text-zinc-400">
              Already have an account?
            </span>
          </div>
        </div>

        {/* Login toggle button */}
        {/*
          Purpose: Give existing users a quicker way to log in instead of signing up
            - When clicked, this will toggle the LoginPanel visibility
            - The text will change based on the login panel state to provide visual feedback 
        */}
        <button
          onClick={() => setShowLoginPanel(!showLoginPanel)}
          className="w-full mb-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors hover:underline"
        >
          {showLoginPanel ? "Hide Login" : "Log In Instead"}
        </button>

        {/* Login Panel - Conditionally Rendered */}
        {/*
          Purpose: Provide a login form for existing users without navigating away from the signup page
          Significance: This allows users who may have accidentally landed on the signup page to easily switch to logging in

        */}
        {showLoginPanel && (
          <div className="mt-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
            <LoginPanel
              // Called when the user clicks "Close" button in the LoginPanel
              onClose={() => setShowLoginPanel(false)}

              // Called when the user successfully logs in through Discord
              onLoginSuccess={(user) => {
                // Hide the login panel
                setShowLoginPanel(false);

                // TODO: Decide where to redirect the user
                // Options:
                // 1. Redirect to browse (see community posts)
                // 2. Redirect to profile
                // 3. Go back to the previous page
                // 4. Stay on the signup page

                // For now, redirect user to the browse page
                router.push("/browse");
              }}
            />
          </div>
        )}

        {/* Support Links */}
        <div className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            By signing up, you agree to our{" "}
            <Link
              href="/terms"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors"
            >
              Terms of Service
            </Link>
            {" "}and{" "}
            <Link
              href="/privacy"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}