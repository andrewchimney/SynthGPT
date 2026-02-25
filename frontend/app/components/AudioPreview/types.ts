// These will be the type definitions for the audio player component
export interface AudioState {
    playing: boolean; // Whether the audio is currently playing
    currentTime: number; // The current time position of the audio in seconds
    duration: number; // The total duration of the audio
    error: null | string; // Any error message related to if the audio fail to load or play
    loading: boolean; // Whether the audio is currently loading
}

export interface AudioControls {
    play: () => Promise<void>; // Start playing the audio
    pause: () => void; // Pause the audio
    toggle: () => Promise<void>; // Toggle between play and pause
    reset: () => void; // Stop the audio and reset to the beginning
    seek: (time: number) => void; // Jump to a specific time in the audio
}