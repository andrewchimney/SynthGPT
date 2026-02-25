import { AudioState, AudioControls} from './types';
import { useEffect, useRef, useState } from "react";

/*
This is the audio player section that manages the audio element, the
current state of the audio (playing, current time, duration), and the 
control functions (play and pause).
*/

export function useAudioPlayer(): [AudioState, AudioControls, React.RefObject<HTMLAudioElement>] {
    // Create a reference to the the HTML audio element to control it directly (pause, play)
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // Create state to track the current time, duration, and whether the audio is playing
    const [state, setState] = useState<AudioState>({
        playing: false,    // Whether the audio is currently playing
        currentTime: 0,    // The current playback time of the audio
        duration: 0,     // The total duration of the audio
        error: null,    // No errors initially
        loading: false,    // Not loading yet
    });

    // Set up event handler on the audio element to mark changes in the audio state (play, pause, time updates)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return; // If the audio element is not available, exit early
        
        // Event flags to update the audio state
        // 1. When the audio progress bar changes, update the audio's current time
        const timeUpdateListener = () =>
            setState((prev: AudioState) => ({ ...prev, currentTime: audio.currentTime }));
        // 2. When the audio starts play, update the audio file info (duration) and set the playing state to true
        const durationChangeListener = () =>
            setState((prev: AudioState) => ({ ...prev, duration: audio.duration || 0}));
        // 3. When the audio finishes playing completely, set the playing state to false
        const endListener = () => setState((prev: AudioState) => ({ ...prev, playing: false }));
        // 4. If the audio encounters an error, set an error message in state
        const errorListener = () =>
            setState((prev: AudioState) => ({ ...prev, error: 'Audio load error' }));
        // 5. When the audio starts playing, set playing to true and clear any previous errors
        const playListener = () => setState((prev: AudioState) => ({ ...prev, playing: true, error: null}));
        // 6. When the audio is paused, set playing to false
        const pauseListener = () => setState((prev: AudioState) => ({ ...prev, playing: false }));   
    
        // Set event listener on the audio elements to call these functions when the corresponding events occur
        audio.addEventListener('timeupdate', timeUpdateListener);
        audio.addEventListener('durationchange', durationChangeListener);
        audio.addEventListener('ended', endListener);
        audio.addEventListener('error', errorListener);
        audio.addEventListener('play', playListener);
        audio.addEventListener('pause', pauseListener);

        // When a component is removed from the page, remove the event handlers to prevent memory leaks
        return () => {
            audio.removeEventListener('timeupdate', timeUpdateListener);
            audio.removeEventListener('durationchange', durationChangeListener);
            audio.removeEventListener('ended', endListener);
            audio.removeEventListener('error', errorListener);
            audio.removeEventListener('play', playListener);
            audio.removeEventListener('pause', pauseListener);
        };
    }, []);

    // Control functions the user is able to interact with
    const controls: AudioControls = {

        /* Play 
        - Start playing the audio from the current time.
        What it will do: 
        1. Clear any previous errors.
        2. Call audio.play() to tell the browser to start playing the audio. 
        3. If the audio fails to play, catch the error and set an error message in state. 
        */

        play: async () => {
            const audio = audioRef.current;
            if (!audio) return; // If the audio element is not available, exit early

            try {
                setState((prev: AudioState) => ({ ...prev, error: null })); // Clear any previous errors
                await audio.play(); // Tell the browser starting playing the audio
            } catch (error) {
                // If the audio fails to play, store the error message in state to display to the user
                setState((prev: AudioState) => ({...prev, error: String(error) }));
            }
        },

        /* Pause 
        - Stop playing the audio, but keep its current time
        What it will do: Call audio.pause() to tell the browser to stop playing the audio.
        */
        pause: () => {
            const audio = audioRef.current;
            if (audio) audio.pause(); // Tell the browser to stop playing the audio
        },

        /* toggle
        - Switch between the play and pause states of the audio.
        What it will do:
        1. Check if the audio is currently playing.
        2. If it is playing, call the pause function to stop it.
        3. If it is not playing, call the play function to start it.
        */
        toggle: async () => {
            if (state.playing) {
                controls.pause();
            } else {
                await controls.play();
            }
        },

        /* reset
        - Stop the audio and reset its current time to the beginning.
        What it will do:
        1. Call the pause function to stop the audio if it is currently playing.
        2. Set the audio's current time to 0 to reset it to the beginning.
        3. Update the state to reflect that the audio is no longer playing and current time is reset.
        */
        reset: () => {
            const audio = audioRef.current;
            if (audio) {
                audio.pause(); // Stop the audio if it is currently playing
                audio.currentTime = 0; // Reset the audio to the beginning
            }
            // Update the state to reflect that the audio is no longer playing and current time is reset
            setState((prev: AudioState) => ({ 
                ...prev, 
                playing: false, 
                currentTime: 0, 
                error: null,
            }));
        },

        /* timestamp
        - Jump to a specific time in the audio
        What it will do:
        1. Make sure the time is valid (not negative and within the duration of the audio).
        2. Set the audio's current time to the specified time to jump to that position
        */
       seek: (time: number) => {
           const audio = audioRef.current;
           if (audio) {
               if (time < 0) {
                   time = 0;
               }
               if (time > audio.duration) {
                   time = audio.duration;
               }
               audio.currentTime = time;
           }
       },
    };

    // Return an array containing the current state of the audio, the control functions, and the audio reference
    return [state, controls, audioRef];
}