'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
    language: string;
    code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const { resolvedTheme } = useTheme();
    const t = useTranslations('chat.codeBlock');

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Map common language aliases
    const languageMap: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        tsx: 'tsx',
        jsx: 'jsx',
        py: 'python',
        rb: 'ruby',
        sh: 'bash',
        yml: 'yaml',
        md: 'markdown',
    };

    const normalizedLanguage = languageMap[language.toLowerCase()] || language.toLowerCase();

    return (
        <div className="group relative my-4 rounded-lg overflow-hidden border border-border">
            {/* Header with language badge and copy button */}
            <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-xs">
                <span className="font-medium text-muted-foreground uppercase tracking-wide">
                    {normalizedLanguage}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-green-500" />
                            <span>{t('copied')}</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>{t('copyCode')}</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Code content */}
            <SyntaxHighlighter
                language={normalizedLanguage}
                style={resolvedTheme === 'dark' ? oneDark : oneLight}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    background: 'transparent',
                }}
                codeTagProps={{
                    style: {
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    },
                }}
                showLineNumbers={code.split('\n').length > 3}
                lineNumberStyle={{
                    minWidth: '2.5em',
                    paddingRight: '1em',
                    color: resolvedTheme === 'dark' ? '#6b7280' : '#9ca3af',
                    userSelect: 'none',
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
}
