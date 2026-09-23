'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, ChevronRight, ChevronLeft, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface TourStep {
  id: string;
  target: string; // CSS selector for the target element
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function GuidedTour({ steps, isOpen, onClose, onComplete }: GuidedTourProps) {
  const t = useTranslations('onboarding');
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  const step = steps[currentStep];

  const highlightElement = useCallback((selector: string) => {
    // Remove previous highlight
    if (highlightedElement) {
      highlightedElement.style.boxShadow = '';
      highlightedElement.style.zIndex = '';
      highlightedElement.style.position = '';
      highlightedElement.style.backgroundColor = '';
    }

    if (!selector) return;

    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2)';
      element.style.zIndex = '50';
      element.style.position = 'relative';
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedElement(element);
    }
  }, [highlightedElement]);

  const handleNext = () => {
    if (step?.action) {
      step.action();
    }

    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      highlightElement(steps[nextStep].target);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      highlightElement(steps[prevStep].target);
    }
  };

  const handleComplete = () => {
    // Remove highlight
    if (highlightedElement) {
      highlightedElement.style.boxShadow = '';
      highlightedElement.style.zIndex = '';
      highlightedElement.style.position = '';
      highlightedElement.style.backgroundColor = '';
    }
    onComplete?.();
    onClose();
  };

  // Initial highlight when tour opens
  if (isOpen && step && !highlightedElement) {
    setTimeout(() => highlightElement(step.target), 100);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-background border border-border rounded-lg shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {t('tourTitle') || 'Guided Tour'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t('tourStep', { current: currentStep + 1, total: steps.length })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleComplete}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-5">
                <Badge variant="outline" className="mb-3 text-xs">
                  {step.position === 'center' ? 'Overview' : `Highlighting ${step.target}`}
                </Badge>
                <h4 className="text-lg font-semibold mb-2">{step.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.content}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
                <div className="flex items-center gap-1">
                  {steps.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentStep
                          ? 'bg-primary w-6'
                          : idx < currentStep
                            ? 'bg-primary/40 w-1.5'
                            : 'bg-muted-foreground/30 w-1.5'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBack}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('backButton') || 'Back'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                  >
                    {currentStep === steps.length - 1
                      ? (t('finishButton') || 'Finish')
                      : (t('nextButton') || 'Next')
                    }
                    {currentStep < steps.length - 1 && (
                      <ChevronRight className="h-4 w-4 ml-1" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage guided tour state
export function useGuidedTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenTour, setHasSeenTour] = useState(false);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setHasSeenTour(true);
    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasSeenGuidedTour', 'true');
    }
  }, []);

  const checkHasSeenTour = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hasSeenGuidedTour') === 'true';
    }
    return false;
  }, []);

  return {
    isOpen,
    startTour,
    closeTour,
    hasSeenTour,
    checkHasSeenTour,
  };
}
