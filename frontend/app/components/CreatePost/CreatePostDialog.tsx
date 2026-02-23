"use client";

import Link from "next/link";

/**
 * Props interface for CreatePostDialog component
 * These props are passed from the parent (browse) to control the dialog
**/
interface CreatePostDialogProps {
    isOpen: boolean;  // Controls whether dialog is visible or hidden
    onClose: () => void;  // Callback function when the user clicks "Cancel"
    onPostAnonymously: () => void; // Callback function when the user clicks "Post Anonymously"
}

/**
 * CreatePostDialog component
 * Purpose: Display a dialog box when a non-loggin-in user clicks the button
 * to create a post. This will display two options:
 * 1. Sign up: Navigates user to signup page and save post to their account
 * 2. Post Anonymously: Post as "Sammy B. Slug" without creating an account
**/
export default function CreatePostDialog({
    isOpen,
    onClose,
    onPostAnonymously,
}: CreatePostDialogProps) {
    /**
    * Early return if the dialog is closed don't render anything!
    * This will prevent the dialog from appearing when isOpen is false.
    **/
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={onClose}  // Close dialog if user clicks outside the dialog box
        >
            {/* Dialog box: centered white container with rounded corners */}
            <div
                className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900"
                onClick={(e) => e.stopPropagation()} // Prevent closing if the user clicks inside the dialog
            >
                {/* Dialog title */}
                <h2 className="mb-4 text-lg font-bold text-black dark:text-white">
                    Create a Post
                </h2>

                {/* Dialog description: explains the two options to the user */}
                <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
                    To save your post and receive credit, please sign up or log in first.
                    Otherwise, you can post anonymously as "Sammy B. Slug," but your post won't
                    be saved to your account.
                </p>

                {/* Button container: holds both action buttons */}
                <div className="flex gap-3">
                    {/* Sign Up Button: navigates the user to the signup page */}
                    <Link
                        href="/signup"
                        className="flex-1 rounded bg-blue-500 py-2 text-center text-white transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                        Sign Up
                    </Link>

                    {/* Post Anonymously Button: calls the parent's handler to post as Sammy B. Slug */}
                    <button
                        onClick={onPostAnonymously}
                        className="flex-1 rounded bg-zinc-300 py-2 text-center text-black transition-colors hover:bg-zinc-400 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
                    >
                        Post Anonymously
                    </button>
                </div>

                {/* Cancel Button: closes the dialog without taking any action */}
                <button
                    onClick={onClose}
                    className="mt-4 w-full rounded bg-zinc-100 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}