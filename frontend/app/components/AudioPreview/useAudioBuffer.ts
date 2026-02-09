import { useEffect } from 'react';
import { AudioControls } from './types';

/*
This hook will manage what audio file is currently loaded
Parameters:
 1. src: The URL of the audio file to lead provided from Supabase
 2. controls: The audio control functions from useAudioPlayer
 3. audioRef: The reference to the HTML audio element
 */

 export function useAudioBuffer(
    src: string,
    controls: AudioControls,
    audioRef: React.RefObject<HTMLAudioElement>
 ) {
    /*
    useEffect will run whenever the src changes which is what 
    */
 }