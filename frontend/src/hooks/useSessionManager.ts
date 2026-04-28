"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Session Manager Hook
 * 
 * Features:
 * - 15-minute inactivity timeout
 * - Activity tracking (mouse, keyboard, API calls)
 * - Complete localStorage cleanup on timeout
 * - Single tab only (no cross-tab communication)
 * - Silent logout (no warnings)
 * - Automatic redirect to Universal_Login
 */
export function useSessionManager() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  // Activity tracking function
  const resetInactivityTimer = () => {
    if (!isActiveRef.current) return;
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 15 minutes
    timeoutRef.current = setTimeout(() => {
      // Silent logout - clear everything and redirect
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        // Also clear cookies
        document.cookie = 'sis_access_token=; path=/; max-age=0';
        document.cookie = 'sis_refresh_token=; path=/; max-age=0';
        router.replace('/login');
      }
    }, 15 * 60 * 1000); // 15 minutes
  };

  // Activity event handlers
  const handleActivity = () => {
    if (isActiveRef.current) {
      resetInactivityTimer();
    }
  };

  useEffect(() => {
    // Only start session management if we're not on login page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath === '/login') {
        return;
      }

      // Check if user is authenticated
      const token = localStorage.getItem('sis_access_token');
      if (!token) {
        return;
      }

      // Start inactivity timer
      resetInactivityTimer();

      // Add activity event listeners
      const events = [
        'mousemove',
        'keydown', 
        'click',
        'scroll',
        'touchstart',
        'focus',
        'blur'
      ];

      events.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
      });

      // Handle visibility change (tab focus/blur)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isActiveRef.current = false;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        } else {
          isActiveRef.current = true;
          resetInactivityTimer();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Cleanup function
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        events.forEach(event => {
          window.removeEventListener(event, handleActivity);
        });
        
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [router]);

  // Return cleanup function for manual logout
  return {
    logout: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        // Also clear cookies
        document.cookie = 'sis_access_token=; path=/; max-age=0';
        document.cookie = 'sis_refresh_token=; path=/; max-age=0';
        router.replace('/login');
      }
    }
  };
}
