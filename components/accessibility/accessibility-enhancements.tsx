'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';

// ARIA Live Region for dynamic content announcements
interface LiveRegionProps {
  message?: string;
  role?: 'status' | 'alert';
  politeness?: 'polite' | 'assertive';
  className?: string;
}

export function LiveRegion({
  message,
  role = 'status',
  politeness = 'polite',
  className,
}: LiveRegionProps) {
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic="true"
      className={className}
      style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
    >
      {message}
    </div>
  );
}

// Focus Trap for modals and dialogs
interface FocusTrapProps {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement>;
}

export function useFocusTrap({ enabled, containerRef }: FocusTrapProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements within the container
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus the first element
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Trigger escape handler if provided
        container.dispatchEvent(new CustomEvent('escape-press'));
      }
    };

    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);

      // Restore focus to the previously focused element
      previousActiveElement.current?.focus();
    };
  }, [enabled, containerRef]);
}

// Skip to Content Link
export function SkipToContent({ href = '#main-content', label }: { href?: string; label?: string }) {
  const t = useTranslations('accessibility');

  return (
    <a
      href={href}
      className="skip-to-content"
      onClick={(e) => {
        e.preventDefault();
        const target = document.querySelector(href) as HTMLElement | null;
        target?.focus();
      }}
    >
      {label || t('skipToContent') || 'Skip to main content'}
    </a>
  );
}

// Announcer for screen readers
export function useAnnouncer() {
  const [announcement, setAnnouncement] = useState('');

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement('');
    // Small delay to ensure the change is detected
    setTimeout(() => {
      setAnnouncement(message);
    }, 100);
  }, []);

  const AnnouncementRegion = useCallback(() => {
    return (
      <>
        <LiveRegion message={announcement} role="status" politeness="polite" />
        <LiveRegion message={announcement} role="alert" politeness="assertive" />
      </>
    );
  }, [announcement]);

  return { announce, AnnouncementRegion };
}

// Focus Management Hook
export function useFocusManagement() {
  const focusRef = useRef<HTMLElement>(null);

  const setFocus = useCallback(() => {
    focusRef.current?.focus();
  }, []);

  const restoreFocus = useCallback((element?: HTMLElement | null) => {
    if (element) {
      element.focus();
    }
  }, []);

  return { focusRef, setFocus, restoreFocus };
}

// Keyboard Navigation Hook
export function useKeyboardNavigation(
  items: any[],
  onSelect: (item: any, index: number) => void,
  onClose?: () => void
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case 'Home':
          e.preventDefault();
          setSelectedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setSelectedIndex(items.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex], selectedIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
      }
    },
    [items, selectedIndex, onSelect, onClose]
  );

  return { selectedIndex, setSelectedIndex, handleKeyDown };
}

// ARIA description provider
interface AriaDescriptionProps {
  id?: string;
  description: string;
}

export function AriaDescription({ id, description }: AriaDescriptionProps) {
  const uniqueId = id || `aria-description-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <span id={uniqueId} className="sr-only">
      {description}
    </span>
  );
}

// Screen reader only text
export function SrOnly({ children, as = 'span' }: { children: React.ReactNode; as?: keyof JSX.IntrinsicElements }) {
  const Tag = as;
  return (
    <Tag className="sr-only" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
      {children}
    </Tag>
  );
}

// Visually hidden but accessible
export function VisuallyHidden({ children, as = 'span' }: { children: React.ReactNode; as?: keyof JSX.IntrinsicElements }) {
  const Tag = as;
  return (
    <Tag
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Tag>
  );
}

// Reduced motion hook
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
}

// High contrast mode hook
export function useHighContrastMode() {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersHighContrast;
}

// Accessible button component
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export function AccessibleButton({
  children,
  loading = false,
  loadingText,
  icon,
  iconPosition = 'left',
  disabled,
  ...props
}: AccessibleButtonProps) {
  const t = useTranslations('common');

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      aria-live="polite"
      {...props}
    >
      {loading && iconPosition === 'left' && (
        <span className="inline-block animate-spin mr-2" aria-hidden="true">
          ⏳
        </span>
      )}
      {icon && iconPosition === 'left' && !loading && <span className="mr-2" aria-hidden="true">{icon}</span>}
      <span>{loading ? (loadingText || t('loading') || 'Loading...') : children}</span>
      {icon && iconPosition === 'right' && !loading && <span className="ml-2" aria-hidden="true">{icon}</span>}
      {loading && iconPosition === 'right' && (
        <span className="inline-block animate-spin ml-2" aria-hidden="true">
          ⏳
        </span>
      )}
    </button>
  );
}

// Accessible form field wrapper
interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: React.ReactElement;
}

export function FormField({ id, label, error, description, required, children }: FormFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const childWithProps = {
    id,
    'aria-describedby': description ? descriptionId : undefined,
    'aria-invalid': !!error,
    'aria-required': required,
    'aria-errormessage': error ? errorId : undefined,
    ...children.props,
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
      </label>
      {React.cloneElement(children, childWithProps)}
      {description && !error && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Progress bar with accessibility
interface AccessibleProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function AccessibleProgress({
  value,
  max = 100,
  label,
  showValue = true,
  className,
}: AccessibleProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={className} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className="bg-primary h-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className="text-sm text-muted-foreground mt-1 block">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
