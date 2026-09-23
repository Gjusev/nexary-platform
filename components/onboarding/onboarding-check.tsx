'use client';

import { useEffect } from 'react';
import { useOnboarding } from './onboarding-provider';
import { OnboardingWizard } from './onboarding-wizard';

/**
 * Component that checks if onboarding should be shown
 * Renders the wizard modal if conditions are met
 */
export function OnboardingCheck() {
    const { status, loading, showWizard } = useOnboarding();

    if (loading || !status) {
        return null;
    }

    // Don't show if completed or skipped
    if (status.completed || status.skipped) {
        return null;
    }

    // Show wizard if flag is true
    if (!showWizard) {
        return null;
    }

    return <OnboardingWizard />;
}
