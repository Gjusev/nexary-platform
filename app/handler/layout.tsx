'use client';

import { StackAuthProvider } from '@/components/providers/stack-provider';

export default function HandlerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <StackAuthProvider>
            {children}
        </StackAuthProvider>
    );
}
