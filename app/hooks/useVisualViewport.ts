'use client';

import { useState, useEffect } from 'react';

interface ViewportState {
    /** Current visual viewport height in pixels */
    height: number;
    /** Estimated keyboard height (window.innerHeight - visualViewport.height) */
    keyboardHeight: number;
    /** Whether keyboard is likely open (keyboardHeight > 100) */
    isKeyboardOpen: boolean;
}

/**
 * Hook to track visual viewport changes, primarily for detecting virtual keyboard.
 * Uses the VisualViewport API where available, with fallback for older browsers.
 * 
 * @returns ViewportState object with height, keyboardHeight, and isKeyboardOpen
 */
export function useVisualViewport(): ViewportState {
    const [state, setState] = useState<ViewportState>({
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
        keyboardHeight: 0,
        isKeyboardOpen: false,
    });

    useEffect(() => {
        // SSR guard
        if (typeof window === 'undefined') return;

        const viewport = window.visualViewport;
        const initialHeight = window.innerHeight;

        const updateViewport = () => {
            const currentHeight = viewport?.height ?? window.innerHeight;
            const keyboardHeight = Math.max(0, initialHeight - currentHeight);

            setState({
                height: currentHeight,
                keyboardHeight,
                isKeyboardOpen: keyboardHeight > 100, // Threshold to account for browser chrome changes
            });
        };

        // Initial update
        updateViewport();

        // Listen to visualViewport if available
        if (viewport) {
            viewport.addEventListener('resize', updateViewport);
            viewport.addEventListener('scroll', updateViewport);
        }

        // Fallback for browsers without visualViewport
        window.addEventListener('resize', updateViewport);

        return () => {
            if (viewport) {
                viewport.removeEventListener('resize', updateViewport);
                viewport.removeEventListener('scroll', updateViewport);
            }
            window.removeEventListener('resize', updateViewport);
        };
    }, []);

    return state;
}

export default useVisualViewport;
