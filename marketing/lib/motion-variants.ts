import type { Variants } from 'framer-motion'

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
}

export const staggerChildren: Variants = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export const cardHover: Variants = {
  hidden: { y: 0 },
  hover: {
    y: -8,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
}
