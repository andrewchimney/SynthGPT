"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

/**
 * Props for the LoginPanel Component:
 * - onLoginSuccess: Optional callback function that runs when a user successfully logs in
 * - onClose: Optional callback function that runs when the login panel is closed
 */
interface LoginPanelProps {
    onLoginSuccess?: (user: User) => void;
    onClose?: () => void;
}

export default function LoginPanel({
    onLoginSuccess,
    onClose,
}: LoginPanelProps) {
    // React hooks to track the component state

    // Store the current logged-in user (null if not logged in)
    const [user, setUser] = useState<User | null>(null);

    // Store any authentication error messages (null if no error)
    const [authError, setAuthError] = useState<string | null>(null);

    // Track whether login is currently in progress (true while redirecting to Discord and waiting for response)
    const [authLoading, setAuthLoading] = useState(false);

    // Environment Variables for Supabase configuration

    // Supabase URL that will identify which database to connect to
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Public API key for Supabase that allows user-side authentication requests 
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Routing: Next.js router to navigate between pages (used for redirecting to profile page after login)
    const router = useRouter();

    /**
     * This will create a connection to the Supabase database using the provided environment variables.
     * It uses useMemo to ensure that the client is only created once and not recreated on every render.
     * By doing this, it will avoid recreating the client on every render.
     * This will return null if the environment variables are not set.
     */
    const supabase = useMemo(() => {
        if (!supabaseUrl || !supabaseAnonKey) return null;
        return createClient(supabaseUrl, supabaseAnonKey);
    }, [supabaseAnonKey, supabaseUrl]);

    /** 
     * Authentication State Listener
     * - This useEffect hook will run when the component mounts and sets up a listener for authentication state changes.
     * - It will check the current state of the user's session and update the user state accordingly (login, logout, session refresh).
    */
    useEffect(() => {
        // Exit early if Supabase isn't configured
        if (!supabase) return;

        // This flag is used to prevent state changes after the component has unmounted
        // This will prevent memory leaks and errors when the component is no longer in use but an authentication event occurs
        let isMounted = true; 

        /**
         * Initial Session Check:
         * When the component loads, check if the user is already logged in, this can happen when
         * - The user has previously logged in and the session is still valid and so the session is restored
         * - The user visits the page again after closing the browser
         */
        supabase.auth.getSession().then(({ data }) => {
            // Don't update the state if the component has already unmounted while fetching the session
            if (!isMounted) return;
            // Update the user state based on the current session 
            setUser(data.session?.user ?? null); 
        });

        /**
         * Real-Time Authentication Listener:
         * - This will set up a real-time listener for authentication events
         * - The listener will trigger whenever there is a change in the user's authentication state
         * - This includes: Signed in, signed out, token refreshed, etc.
         */
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            // Don't update the state if the component has already unmounted
            if (!isMounted) return;
            // Update the user state based on the new session
            // If a session exists, set user as logged-in, otherwise set user to null (logged-out)
            setUser(session?.user ?? null);

            // This will notify the parent component when a user successfully logs in
            if (session?.user && onLoginSuccess) {
                onLoginSuccess(session.user);
            }
        });

        /**
         * Cleanup Function:
         * - This function will run when the component unmounts (the user navigates away from the page)
         * - This will prevent memory leaks and cleanup resources when the component is no longer in use.
        */
        return () => {
            // This will mark the component as unmounted so that no state updates will occur after this point
            isMounted = false;
            // This will stop listening for authentication state changes
            listener.subscription.unsubscribe(); 
        };
        // This will re-run if the Supabase client or callback changes
    }, [supabase, onLoginSuccess]); 

    /**
     * Discord Login Handler
     * Triggered when the user clicks "Continue with Discord" button
     * How it will work:
     * - 1. Clear any previous errors
     * - 2. Show loading state ("Redirecting...")
     * - 3. Redirect to Discord login page
     * - 4. Users log in with Discord
     * - 5. Discord redirects back to the site
     * - 6. Supabase automatically creates a session for the user and listens for authentication state changes
     * - 7. useEffect listener will detect login and updates the user state accordingly
     */
    const handleDiscordLogin = async () => {
    if (!supabase) {
        // Check if Supabase is properly configured before attempting to log in
        setAuthError("Supabase not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).");
        return;
    }

    // Clear any previous authentication error messages
    setAuthError(null);
    // Set loading state to show "Redirecting..." on button while the OAuth flow is in progress
    setAuthLoading(true);

    /**
     * OAuth Sign-In with Discord:
     * - 1. User clicks the login button and initiates the OAuth flow with Discord
     * - 2. User is redirected to Discord login page
     * - 3. User enters their Discord credentials
     * - 4. User authorizes the site to access their Discord account information
     * - 5. User is redirected back to the site
     * - 6. Supabase creates a session for the user
     * - 7. Component detects login through the useEffect listener and updates the user state accordingly
     */
    const { error } = await supabase.auth.signInWithOAuth({
        // This will use Discord as the login provider
        provider: "discord",
        options: {
            // After Discord login, this will redirect the user back to the current page
            redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
    });

    // This will stop showing the loading state since the OAuth flow has been initiated
    setAuthLoading(false);
    // If the login attempt fails, store the error message to show to the user
    if (error) setAuthError(error.message);
  };

  /**
   * Sign Out Handler:
   * - Triggered when the user clicks the "Sign Out" button
   * - This will clear the user's session from Supabase and log them out
   * - After signing out, it will call the onClose callback to close the login panel
   * - The useEffect listener will detect the logout and update the user state to null (logged-out state)
   */
    const handleSignOut = async () => {
        // This will check if Supabase is configured before attempting to sign out
        if (!supabase) return;
        // Clear the user's session from Supabase
        await supabase.auth.signOut();
        // This will notify the parent component that the login panel should be closed after signing out
        onClose?.();
    };

    /**
     * Error State Handler:
     * If the Supabase client is null (env vars are missing), show an error message instead of rendering the logic panel
     * This will prevent errors with the component trying to use an unconfigured Supabase client
     */
    if (!supabase) {
        return (
            <div className="text-sm text-red-600 dark:text-red-400">
                Supabase env vars missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </div>
        );
    }

    /**
     * Render the Logic Panel UI:
     * This is the main component output that will either show
     * - 1. Logged-in state: shows the user's email and a "Sign out" button
     * - 2. Logged-out state: Discord login button and any authentication error messages
     */
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900">
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-3">
                {/* Panel title */}
                <div className="text-sm font-semibold text-black dark:text-white">Account</div>
                
                {/* Close button */}
                <button
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>

            {/* Conditional Rendering: shows different UI based on login state */}

            {/* Logged-in state: Display when the user is logged in */}
            {user? (
                <div className="space-y-3">
                    {/* Profile button: shows the user's Discord email */}
                    {/* When clicked, this will redirect the user to the profile page */}
                    <button
                        onClick={() => router.push("/profile")}
                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 text-left hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 w-full"
                    >
                        Signed in as <span className="font-medium">{user.email}</span>
                    </button>

                    {/* Sign out button */}
                    <button
                        onClick={handleSignOut}
                        className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                        Sign out
                    </button>
                </div>
            ) : (
                /* Logged Out State: Display when the user is not logged in */
                <div className="space-y-3">
                    {/* Prompt the user to sign in */}
                    <div className="text-sm text-zinc-700 dark:text-zinc-200">Sign in to continue</div>

                    {/* Discord Login Button */}
                    <button
                        onClick={handleDiscordLogin}
                        // Disable the button while login is in progress to prevent multiple clicks
                        disabled={authLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                    >
                        {/* Discord emoji icon */}
                        <span aria-hidden>💬</span>

                        {/* The button text will change based on the loading state */}
                        {authLoading ? "Redirecting..." : "Continue with Discord"}
                    </button>

                    {/* Show an error message if the login fails*/}
                    {authError && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                            {authError}
                        </div> 
                    )}
                </div>
            )}
        </div>
    );
}