'use client';

import { useRef } from 'react';
import { useInView, Variants } from 'framer-motion';

interface ScrollRevealOptions {
    from?: { y?: number; opacity?: number; x?: number; scale?: number };
    stagger?: number;
    trigger?: 'top 80%' | 'top 70%' | 'top 90%' | 'top 85%';
    duration?: number;
    once?: boolean;
}

// Framer Motion variants for scroll reveal animations
export function getScrollRevealVariants(options: ScrollRevealOptions = {}): Variants {
    const { from = { y: 50, opacity: 0 }, duration = 0.6 } = options;

    return {
        hidden: {
            opacity: from.opacity ?? 0,
            y: from.y ?? 0,
            x: from.x ?? 0,
            scale: from.scale ?? 1,
        },
        visible: {
            opacity: 1,
            y: 0,
            x: 0,
            scale: 1,
            transition: {
                duration,
                ease: [0.16, 1, 0.3, 1], // expo.out equivalent
            },
        },
    };
}

// Container variants with stagger for children
export function getStaggerContainerVariants(stagger: number = 0.1): Variants {
    return {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: stagger,
            },
        },
    };
}

// Simple hook that returns ref and inView state
export function useScrollReveal(options: ScrollRevealOptions = {}) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, {
        once: options.once ?? true,
        margin: "-10% 0px -10% 0px" // Similar to 'top 80%'
    });

    return { ref, isInView };
}

// Combined hook returning everything needed
export function useScrollRevealAnimation(options: ScrollRevealOptions = {}) {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, {
        once: options.once ?? true,
        margin: "-10% 0px -10% 0px"
    });

    const variants = getScrollRevealVariants(options);
    const containerVariants = getStaggerContainerVariants(options.stagger);

    return {
        ref,
        isInView,
        variants,
        containerVariants,
        animate: isInView ? 'visible' : 'hidden',
    };
}
