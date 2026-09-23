'use client';

import { useLenis } from '@/hooks/use-lenis';

export default function SmoothScrollProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    useLenis();

    return <>{children}</>;
}
