'use client';

import { useEffect, createContext, useContext, ReactNode } from 'react';
import Script from 'next/script';

// Extend Window interface for Umami
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, properties?: Record<string, any>) => void;
      trackView: (path: string) => void;
    };
  }
}

interface AnalyticsContextType {
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  trackPageView: (path: string) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

interface AnalyticsProviderProps {
  children: ReactNode;
  enabled?: boolean;
  websiteId?: string;
  scriptUrl?: string;
}

export function AnalyticsProvider({
  children,
  enabled = true,
  websiteId = '4c2c0a9f-3662-47d7-a577-8f1574b02d84',
  scriptUrl = 'https://umami.example.com/script.js',
}: AnalyticsProviderProps) {
  // Track event function
  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      // Umami event tracking
      if (window.umami) {
        window.umami.track(eventName, properties);
      }
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  };

  // Track page view
  const trackPageView = (path: string) => {
    if (!enabled || typeof window === 'undefined') return;

    try {
      if (window.umami) {
        window.umami.trackView(path);
      }
    } catch (error) {
      console.warn('Analytics page view tracking error:', error);
    }
  };

  return (
    <AnalyticsContext.Provider value={{ trackEvent, trackPageView }}>
      {children}

      {enabled && (
        <Script
          src={scriptUrl}
          data-website-id={websiteId}
          defer
          strategy="afterInteractive"
        />
      )}
    </AnalyticsContext.Provider>
  );
}

// Hook to use analytics
export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}