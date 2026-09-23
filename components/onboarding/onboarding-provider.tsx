'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser } from '@stackframe/stack';

interface OnboardingStatus {
    completed: boolean;
    current_step: number;
    completed_steps: number[];
    badges: string[];
    skipped: boolean;
    started_at: string | null;
    completed_at: string | null;
}

interface OnboardingContextValue {
    status: OnboardingStatus | null;
    loading: boolean;
    goToStep: (step: number) => Promise<void>;
    completeStep: (step: number) => Promise<void>;
    skipOnboarding: () => Promise<void>;
    completeOnboarding: () => Promise<void>;
    showWizard: boolean;
    setShowWizard: (show: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error('useOnboarding must be used within OnboardingProvider');
    }
    return context;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
    const user = useUser({ or: 'return-null' });
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    // Fetch initial onboarding status
    const fetchStatus = useCallback(async () => {
        // Prevent multiple simultaneous calls
        if (isFetching || hasFetched) {
            return;
        }

        if (!user) {
            setLoading(false);
            return;
        }

        setIsFetching(true);
        setHasFetched(true);

        // Quick check from clientMetadata first
        const clientMeta = user.clientMetadata as Record<string, unknown> | null;
        if (clientMeta?.onboardingCompleted === true) {
            setStatus({
                completed: true,
                current_step: 4,
                completed_steps: [1, 2, 3, 4],
                badges: [],
                skipped: false,
                started_at: null,
                completed_at: null,
            });
            setShowWizard(false);
            setLoading(false);
            setIsFetching(false);
            return;
        }

        try {
            const response = await fetch('/api/onboarding/status');
            if (response.ok) {
                const data = await response.json();
                setStatus(data);

                // Show wizard if user hasn't completed and hasn't skipped
                if (!data.completed && !data.skipped) {
                    setShowWizard(true);
                }
            }
        } catch (error) {
            console.error('[Onboarding Provider] Error fetching status:', error);
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    }, [user, isFetching, hasFetched]);

    useEffect(() => {
        fetchStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]); // Only re-fetch when user changes, not when fetchStatus changes

    const goToStep = async (step: number) => {
        if (!user) return;

        try {
            const response = await fetch('/api/onboarding/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step }),
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
            }
        } catch (error) {
            console.error('[Onboarding] Error updating step:', error);
        }
    };

    const completeStep = async (step: number) => {
        await goToStep(step);
    };

    const skipOnboarding = async () => {
        if (!user) return;

        try {
            const response = await fetch('/api/onboarding/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skipped: true }),
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
                setShowWizard(false);

                // Also save to clientMetadata for fast lookup next time
                try {
                    const currentMeta = (user.clientMetadata as object) || {};
                    await user.update({
                        clientMetadata: {
                            ...currentMeta,
                            onboardingCompleted: true,
                        },
                    });
                } catch (e) {
                    console.error('[Onboarding] Error saving to clientMetadata:', e);
                }
            }
        } catch (error) {
            console.error('[Onboarding] Error skipping:', error);
        }
    };

    const completeOnboarding = async () => {
        if (!user) return;

        try {
            const response = await fetch('/api/onboarding/complete', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json();
                setStatus(data);
                setShowWizard(false);

                // Save to clientMetadata for fast lookup
                try {
                    const currentMeta = (user.clientMetadata as object) || {};
                    await user.update({
                        clientMetadata: {
                            ...currentMeta,
                            onboardingCompleted: true,
                        },
                    });
                } catch (e) {
                    console.error('[Onboarding] Error saving to clientMetadata:', e);
                }
            }
        } catch (error) {
            console.error('[Onboarding] Error completing:', error);
        }
    };

    const value: OnboardingContextValue = {
        status,
        loading,
        goToStep,
        completeStep,
        skipOnboarding,
        completeOnboarding,
        showWizard,
        setShowWizard,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}
