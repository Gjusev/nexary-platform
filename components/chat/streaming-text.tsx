'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface StreamingTextProps {
  content: string;
  speed?: number; // milliseconds per character
  className?: string;
  onComplete?: () => void;
}

export function StreamingText({
  content,
  speed = 10,
  className = '',
  onComplete,
}: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    setDisplayedContent('');
    setIsComplete(false);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const charsToShow = Math.min(
        Math.floor(elapsed / speed),
        content.length
      );

      setDisplayedContent(content.slice(0, charsToShow));

      if (charsToShow < content.length) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, speed, onComplete]);

  return (
    <span className={`inline-block ${className}`}>
      {displayedContent}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle"
        />
      )}
    </span>
  );
}

// Streaming text with word-by-word animation (better for long content)
interface StreamingWordsProps {
  content: string;
  speed?: number; // milliseconds per word
  className?: string;
  onComplete?: () => void;
}

export function StreamingWords({
  content,
  speed = 50,
  className = '',
  onComplete,
}: StreamingWordsProps) {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const words = content.split(' ');
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    setDisplayedWords([]);
    setIsComplete(false);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const wordsToShow = Math.min(
        Math.floor(elapsed / speed),
        words.length
      );

      setDisplayedWords(words.slice(0, wordsToShow));

      if (wordsToShow < words.length) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, speed, onComplete, words]);

  return (
    <span className={`inline-block ${className}`}>
      {displayedWords.join(' ')}
      {!isComplete && displayedWords.length > 0 && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-4 ml-1 bg-primary align-middle"
        />
      )}
    </span>
  );
}

// Typing effect with realistic delays (faster for common words, slower for punctuation)
interface RealisticTypingProps {
  content: string;
  baseSpeed?: number;
  className?: string;
  onComplete?: () => void;
}

export function RealisticTyping({
  content,
  baseSpeed = 30,
  className = '',
  onComplete,
}: RealisticTypingProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setDisplayedContent('');
    setCurrentIndex(0);

    const typeNextChar = (index: number) => {
      if (index >= content.length) {
        onComplete?.();
        return;
      }

      const char = content[index];
      let delay = baseSpeed;

      // Add delay after punctuation
      if (['.', '!', '?'].includes(char)) {
        delay = baseSpeed * 5;
      } else if ([',', ';', ':'].includes(char)) {
        delay = baseSpeed * 3;
      } else if (char === ' ') {
        delay = baseSpeed * 0.5;
      }

      setDisplayedContent(content.slice(0, index + 1));
      setCurrentIndex(index + 1);

      timeoutRef.current = setTimeout(() => {
        typeNextChar(index + 1);
      }, delay);
    };

    typeNextChar(0);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, baseSpeed, onComplete]);

  return (
    <span className={`inline-block ${className}`}>
      {displayedContent}
      {currentIndex < content.length && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle"
        />
      )}
    </span>
  );
}

// Streaming markdown content (for chat messages)
interface StreamingMarkdownProps {
  content: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function StreamingMarkdown({
  content,
  speed = 5,
  className = '',
  onComplete,
}: StreamingMarkdownProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    setDisplayedContent('');
    setIsComplete(false);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const charsToShow = Math.min(
        Math.floor(elapsed / speed),
        content.length
      );

      setDisplayedContent(content.slice(0, charsToShow));

      if (charsToShow < content.length) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, speed, onComplete]);

  // Simple markdown syntax highlighting for code blocks
  const formatMarkdown = (text: string) => {
    // This is a simplified version - you'd use a proper markdown parser in production
    return text;
  };

  return (
    <span className={`inline-block ${className}`}>
      {formatMarkdown(displayedContent)}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle"
        />
      )}
    </span>
  );
}
