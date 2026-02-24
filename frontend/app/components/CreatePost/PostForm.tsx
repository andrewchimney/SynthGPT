"use client";

import React from "react";

/**
 * Preset option shown in the dropdown menu when creating a post.
 * This is used to provide users with the minimal required information to create a post.
**/
export interface PresetOption {
    id: string; // Unique identifier for the preset option, used to distinguish between different options
    title: string; // The title of the preset option selection
    preview_url?: string | null; // URL for a preview image of the preset option
}
/**
 * Values to represent the current state of the post form.
 * These values are used to represent the main user input when creating a post.
**/
export interface PostFormValues {
    title: string; // The title of the post being created
    description: string; // The description of the post being created
    preset_id: string | null; // The ID of the selected preset or null if no preset is selected
    uploaded_file: File | null; // A .vital file uploaded by the user
}

/**
 * PostForm component represents the form used to create a new post.
 * It is regulated by the parent component (CreatePost) which manages the state of the form and handles form submission logic.
**/
interface PostFormProps {
    presets: PresetOption[]; // An array of preset options that the user can select from when creating a post
    values: PostFormValues; // The current values of the form fields (title, description and preset_id)
    onChange: (values: PostFormValues) => void; // Callback function to handle changes in the form fields and updates the parent's component state
    onSubmit: () => void; // Callback function to handle form submission when the user clicks the "Create Post" button
    isSubmitting?: boolean; // Indicates whether the form is currently being submitted. If so, the submit button will be disabled to prevent multiple submissions
    error?: string | null; // An optional error message that can be displayed to the user if there is an issue with form submission
}

/**
 * PostForm component
 * Purpose: Display a form for creating a new post with:
 * - Title (required) 
 * - Description (optional)
 * - Preset selection (optional dropdown)
**/
export default function PostForm({
    presets,
    values,
    onChange,
    onSubmit,
    isSubmitting = false,
    error = null,
}: PostFormProps) {
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault(); // Prevent the full page from refreshing when the form is submitted
                onSubmit(); // Call the onSubmit callback function passed from the parent component to handle form submission logic
            }}
            className="space-y-4"
        >
            {/* Title input: required field */}
            <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                    Title
                </label>
                <input
                    type="text"
                    value={values.title}
                    onChange={(e) => onChange({ ...values, title: e.target.value })}
                    placeholder="Enter a title for your post"
                    required
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
            </div>

            {/* Description: Optional text area for additional details about the post */}
            <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                    Description
                </label>
                <textarea
                    value={values.description}
                    onChange={(e) => onChange({ ...values, description: e.target.value })}
                    placeholder="Enter a description for your post"
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
            </div>

            {/* Preset selection: optional dropdown */}
            <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                    Preset (optional)
                </label>
                <select
                    value={values.preset_id ?? ""} // Use an empty string if there is no preset selected
                    onChange={(e) => onChange({ ...values, preset_id: e.target.value || null })} // Convert empty string back to null if no preset is selected
                    className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                    <option value="">Select a preset</option>
                    {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Upload preset: optional .vital file upload */}
            <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-1">
                    Upload preset...
                </label>
                <label
                    className="flex items-center justify-center w-full rounded border-2 border-dashed border-zinc-300 bg-white px-3 py-4 text-sm text-zinc-500 cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-750"
                >
                    <span>
                        {values.uploaded_file ? values.uploaded_file.name : "Upload . . ."}
                    </span>
                    <input
                        type="file"
                        accept=".vital"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            onChange({ ...values, uploaded_file: file });
                        }}
                    />
                </label>
                {values.uploaded_file && (
                    <button
                        type="button"
                        onClick={() => onChange({ ...values, uploaded_file: null })}
                        className="mt-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                        Remove file
                    </button>
                )}
            </div>

            {/* Optional error message */}
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Submit button with loading state*/}
            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded bg-green-500 py-2 text-white transition-colors hover:bg-green-600 disabled:bg-zinc-400 dark:bg-green-600 dark:hover:bg-green-700"
            >
                {isSubmitting ? "Posting..." : "Create Post"}
            </button>
        </form>
    );
}