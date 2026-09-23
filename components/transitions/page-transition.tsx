'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Smooth page transition wrapper using framer-motion
 * Provides fade and slide animations for page changes
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.25,
        ease: [0.4, 0, 0.2, 1], // Material Design easing
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Smooth fade-in transition for chat messages
 */
export function FadeIn({ children, className = '', delay = 0 }: PageTransitionProps & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger children animation for lists
 */
export function StaggerChildren({ children, className = '', staggerDelay = 0.05 }: PageTransitionProps & { staggerDelay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scale and fade transition for new chat creation
 */
export function ScaleIn({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
