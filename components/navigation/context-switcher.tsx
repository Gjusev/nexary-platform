'use client';

/**
 * Context Switcher Component
 *
 * Button to switch between chat and dashboard contexts.
 * Maintains the current team and conversation context when switching.
 */

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageSquare, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextSwitcherProps {
  /** Team slug to maintain when switching contexts */
  teamSlug?: string;
  /** Optional CSS class name */
  className?: string;
  /** Variant of the button */
  variant?: 'default' | 'ghost' | 'outline' | 'secondary' | 'link';
  /** Size of the button */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Context switcher button for navigating between chat and dashboard.
 *
 * @example
 * ```tsx
 * // In chat context - shows link to dashboard
 * <ContextSwitcher teamSlug={teamSlug} />
 *
 * // In dashboard context - shows link to chat
 * <ContextSwitcher teamSlug={teamSlug} variant="ghost" />
 * ```
 */
export function ContextSwitcher({
  teamSlug,
  className,
  variant = 'ghost',
  size = 'default',
}: ContextSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current context
  const isChatContext = pathname?.startsWith('/chat');
  const isDashboardContext = pathname?.startsWith('/dashboard');

  // Don't render if we're not in either context
  if (!isChatContext && !isDashboardContext) {
    return null;
  }

  const handleClick = () => {
    if (isChatContext) {
      // Switch to dashboard
      router.push('/dashboard');
    } else if (isDashboardContext) {
      // Switch to chat
      router.push('/chat');
    }
  };

  const icon = isChatContext ? LayoutDashboard : MessageSquare;
  const label = isChatContext ? 'Dashboard' : 'Chat';
  const Icon = icon;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn('gap-2', className)}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}
