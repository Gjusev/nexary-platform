'use client';

import { ReactNode, useRef, useCallback, useState, TouchEvent } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Trash2, Archive, Star, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SwipeAction {
  id: string;
  icon: ReactNode;
  label: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

interface SwipeableProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  className?: string;
  threshold?: number;
}

export function Swipeable({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeStart,
  onSwipeEnd,
  className,
  threshold = 100,
}: SwipeableProps) {
  const x = useMotionValue(0);
  const [hasSwiped, setHasSwiped] = useState(false);
  const [actionTriggered, setActionTriggered] = useState(false);

  const backgroundColor = useTransform(
    x,
    [-threshold, 0, threshold],
    [
      rightActions.length > 0 ? rightActions[0].backgroundColor : 'transparent',
      'transparent',
      leftActions.length > 0 ? leftActions[0].backgroundColor : 'transparent',
    ]
  );

  const handleDragStart = useCallback(() => {
    onSwipeStart?.();
    setHasSwiped(true);
  }, [onSwipeStart]);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      onSwipeEnd?.();
      setHasSwiped(false);

      if (actionTriggered) {
        setActionTriggered(false);
        return;
      }

      const thresholdMet = Math.abs(info.offset.x) > threshold;

      if (thresholdMet) {
        // Determine which action was triggered
        if (info.offset.x > 0 && leftActions.length > 0) {
          leftActions[0].onPress();
        } else if (info.offset.x < 0 && rightActions.length > 0) {
          rightActions[0].onPress();
        }
      }
    },
    [onSwipeEnd, threshold, leftActions, rightActions, actionTriggered]
  );

  const handleActionPress = useCallback((action: SwipeAction) => {
    setActionTriggered(true);
    action.onPress();
  }, []);

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {/* Background Actions */}
      <motion.div
        className="absolute inset-0 flex items-center justify-between px-4"
        style={{ backgroundColor }}
      >
        {leftActions.length > 0 && (
          <div className="flex gap-2">
            {leftActions.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="icon"
                className={action.color}
                onClick={() => handleActionPress(action)}
              >
                {action.icon}
              </Button>
            ))}
          </div>
        )}
        {rightActions.length > 0 && (
          <div className="flex gap-2">
            {rightActions.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="icon"
                className={action.color}
                onClick={() => handleActionPress(action)}
              >
                {action.icon}
              </Button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Foreground Content */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="relative bg-background"
        whileTap={{ scale: 0.98 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Touch Ripple Effect
interface RippleProps {
  children: ReactNode;
  className?: string;
  color?: string;
}

export function Ripple({ children, className, color = 'rgba(255, 255, 255, 0.5)' }: RippleProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const addRipple = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    const ripple = {
      x: 'nativeEvent' in event ? (event as React.MouseEvent).clientX : (event as React.TouchEvent).touches[0].clientX,
      y: 'nativeEvent' in event ? (event as React.MouseEvent).clientY : (event as React.TouchEvent).touches[0].clientY,
      id: Date.now(),
    };
    setRipples((prev) => [...prev, ripple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 600);
  }, []);

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      onTouchStart={addRipple}
      onMouseDown={addRipple}
    >
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

// Pull to Refresh
interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className,
}: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY.current);
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5));
    },
    [isPulling, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || isRefreshing) return;

    setIsPulling(false);

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }

    setPullDistance(0);
  }, [isPulling, isRefreshing, pullDistance, threshold, onRefresh]);

  const rotate = useTransform(
    useMotionValue(pullDistance),
    [0, threshold],
    [0, 360]
  );

  return (
    <div
      className={cn('relative min-h-screen', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <motion.div
          className="absolute top-0 left-0 right-0 flex items-center justify-center"
          style={{ height: Math.min(pullDistance, threshold) }}
        >
          <motion.div
            style={{ rotate }}
            className="text-primary"
          >
            <MoreHorizontal className="w-6 h-6" />
          </motion.div>
        </motion.div>
      )}
      {children}
    </div>
  );
}

// Long Press Detector
interface LongPressProps {
  children: ReactNode;
  onLongPress: () => void;
  duration?: number;
  className?: string;
}

export function LongPress({
  children,
  onLongPress,
  duration = 500,
  className,
}: LongPressProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();

  const startPress = useCallback(() => {
    setIsPressing(true);
    setProgress(0);

    // Animate progress
    intervalRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + 10, 100));
    }, duration / 10);

    // Trigger long press after duration
    timeoutRef.current = setTimeout(() => {
      onLongPress();
      setIsPressing(false);
      setProgress(0);
    }, duration);
  }, [duration, onLongPress]);

  const cancelPress = useCallback(() => {
    setIsPressing(false);
    setProgress(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return (
    <motion.div
      className={cn('relative', className)}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      whileTap={{ scale: 0.98 }}
    >
      {children}
      {isPressing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-primary/20 rounded-lg flex items-center justify-center"
        >
          <div className="w-16 h-16">
            <svg className="transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeDasharray={175.93}
                strokeDashoffset={175.93 * (1 - progress / 100)}
                className="text-primary"
              />
            </svg>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Preset swipe actions
export const swipeActions = {
  delete: (onPress: () => void): SwipeAction => ({
    id: 'delete',
    icon: <Trash2 className="h-5 w-5" />,
    label: 'Delete',
    color: 'text-destructive',
    backgroundColor: 'bg-destructive/10',
    onPress,
  }),
  archive: (onPress: () => void): SwipeAction => ({
    id: 'archive',
    icon: <Archive className="h-5 w-5" />,
    label: 'Archive',
    color: 'text-blue-500',
    backgroundColor: 'bg-blue-500/10',
    onPress,
  }),
  favorite: (onPress: () => void): SwipeAction => ({
    id: 'favorite',
    icon: <Star className="h-5 w-5" />,
    label: 'Favorite',
    color: 'text-yellow-500',
    backgroundColor: 'bg-yellow-500/10',
    onPress,
  }),
};
