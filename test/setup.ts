import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js internationalization
vi.mock('next-intl', () => ({
  useTranslations() {
    return (key: string) => key;
  },
  useLocale() {
    return 'en';
  },
}));

// Mock Stack Auth
vi.mock('@stackframe/stack', () => ({
  useUser() {
    return {
      user: null,
    };
  },
  useTeam() {
    return {
      team: null,
    };
  },
}));

// Mock environment variables
process.env.NEXT_PUBLIC_STACK_API_KEY = 'test-key';
process.env.NEXT_PUBLIC_STACK_PROJECT_ID = 'test-project';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
