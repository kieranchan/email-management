'use client';

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Custom hook for responsive media queries using useSyncExternalStore
 * This approach avoids the setState-in-effect lint error
 * @param query - CSS media query string, e.g. '(max-width: 768px)'
 * @returns boolean - whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (callback: () => void) => {
            if (typeof window === 'undefined') return () => { };
            const media = window.matchMedia(query);
            media.addEventListener('change', callback);
            return () => media.removeEventListener('change', callback);
        },
        [query]
    );

    const getSnapshot = useCallback(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    }, [query]);

    const getServerSnapshot = useCallback(() => false, []);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Convenience hook for mobile detection
 * @returns boolean - true if viewport width < 768px
 */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 767px)');
}

/**
 * Convenience hook for tablet detection
 * @returns boolean - true if viewport width between 768px and 1023px
 */
export function useIsTablet(): boolean {
    return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

/**
 * M7: Convenience hook for desktop detection (three-column layout)
 * @returns boolean - true if viewport width >= 1024px
 */
export function useIsDesktop(): boolean {
    return useMediaQuery('(min-width: 1024px)');
}
