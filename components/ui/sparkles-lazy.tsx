'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

const SparklesCore = dynamic(
  () => import('@/components/ui/sparkles').then(mod => ({ default: mod.SparklesCore })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0" />
    ),
  }
);

export default SparklesCore;
export { SparklesCore as SparklesComponent };
export type SparklesProps = ComponentProps<typeof SparklesCore>;