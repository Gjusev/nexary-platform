'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useTranslations } from 'next-intl';

import { useOnboarding } from './onboarding-provider';
import { PreferencesStep } from './steps/preferences-step';
import { WelcomeStep } from './steps/welcome-step';
import { UploadStep } from './steps/upload-step';
import { QueryStep } from './steps/query-step';
import { TemplatesStep } from './steps/templates-step';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const TOTAL_STEPS = 5;

export function OnboardingWizard() {
    const t = useTranslations('onboarding');
    const { status, goToStep, completeOnboarding, skipOnboarding, setShowWizard } = useOnboarding();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    const [showSkipDialog, setShowSkipDialog] = useState(false);

    const steps = [
        { id: 1, title: t('preferences.title'), component: PreferencesStep },
        { id: 2, title: t('welcome.title'), component: WelcomeStep },
        { id: 3, title: t('upload.title'), component: UploadStep },
        { id: 4, title: t('query.title'), component: QueryStep },
        { id: 5, title: t('templates.title'), component: TemplatesStep },
    ];

    // Ensure we don't go out of bounds if steps change
    const safeStepIndex = Math.min(currentStepIndex, steps.length - 1);
    const currentStep = steps[safeStepIndex];
    const progress = ((safeStepIndex + 1) / TOTAL_STEPS) * 100;

    useEffect(() => {
        if (status && status.current_step > 0) {
            // Resume from last step, capped at max
            setCurrentStepIndex(Math.min(status.current_step - 1, TOTAL_STEPS - 1));
        }
    }, [status]);

    const handleNext = async () => {
        const nextIndex = currentStepIndex + 1;

        if (nextIndex >= TOTAL_STEPS) {
            // Completed all steps
            await completeOnboarding();

            // Trigger confetti celebration
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            });

            return;
        }

        await goToStep(nextIndex + 1);
        setCurrentStepIndex(nextIndex);
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            const prevIndex = currentStepIndex - 1;
            setCurrentStepIndex(prevIndex);
            goToStep(prevIndex + 1);
        }
    };

    const handleSkipClick = () => {
        setShowSkipDialog(true);
    };

    const confirmSkip = async () => {
        setShowSkipDialog(false);
        await skipOnboarding();
        setIsExiting(true);
    };

    const handleClose = () => {
        if (currentStepIndex === 0) {
            handleSkipClick();
        } else {
            // Just hide, don't skip - user can resume later
            setShowWizard(false);
        }
    };

    const StepComponent = currentStep.component;

    return (
        <>
            <Dialog open={!isExiting} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden sm:max-w-4xl">
                    <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b">
                            <div className="flex items-center gap-3">
                                <Sparkles className="h-6 w-6 text-primary" />
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        {currentStep.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {t('progress', { current: safeStepIndex + 1, total: TOTAL_STEPS })}
                                    </p>
                                </div>
                            </div>
                            {/* X button is provided by DialogContent */}
                        </div>

                        {/* Progress Bar */}
                        <div className="px-6 pt-4">
                            <Progress value={progress} className="h-2" />
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="h-full"
                                >
                                    <StepComponent onNext={handleNext} />
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
                            <div className="flex gap-2">
                                {currentStepIndex > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                    >
                                        <ChevronLeft className="mr-2 h-4 w-4" />
                                        {t('backButton')}
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    onClick={handleSkipClick}
                                    className="text-muted-foreground"
                                >
                                    {t('skipButton')}
                                </Button>
                            </div>

                            <div className="flex gap-2">
                                {/* Step indicators */}
                                <div className="flex items-center gap-1.5 mr-4">
                                    {steps.map((step, idx) => (
                                        <div
                                            key={step.id}
                                            className={`h-2 w-2 rounded-full transition-all ${idx === safeStepIndex
                                                ? 'bg-primary w-6'
                                                : idx < safeStepIndex
                                                    ? 'bg-primary/60'
                                                    : 'bg-muted-foreground/30'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('skipButton')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('preferences.note') || "Are you sure you want to skip onboarding? You can assume all defaults."}
                            {/* Using a generic message if generic skip message missing, but t('skipButton') is 'Skip' */}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmSkip}>Confirm Skip</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
