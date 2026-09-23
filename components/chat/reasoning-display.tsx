'use client';

/**
 * Reasoning Display Component
 *
 * Displays the AI's reasoning process after completion.
 * Shows markdown-rendered reasoning with syntax highlighting.
 */

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/code-block';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReasoningDisplayProps {
  /** The reasoning text to display */
  reasoning: string;
  /** Model name that generated the reasoning */
  modelName: string;
  /** Whether to show the reasoning expanded by default */
  defaultExpanded?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Reasoning display component with markdown rendering and copy functionality.
 *
 * @example
 * ```tsx
 * <ReasoningDisplay
 *   reasoning="Let me think about this step by step..."
 *   modelName="o1 Mini"
 *   defaultExpanded={false}
 * />
 * ```
 */
export function ReasoningDisplay({
  reasoning,
  modelName,
  defaultExpanded = false,
  className,
}: ReasoningDisplayProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reasoning);
      setCopied(true);
      toast({
        title: 'Razonamiento copiado',
        description: 'El proceso de pensamiento ha sido copiado al portapapeles.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Error al copiar',
        description: 'No se pudo copiar el razonamiento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border border-border bg-muted/30 overflow-hidden', className)}
    >
      {/* Header */}
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Proceso de Pensamiento</span>
            <Badge variant="outline" className="text-xs">
              {modelName}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      {/* Content */}
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-0">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  // Handle code blocks with syntax highlighting
                  if (match) {
                    return <CodeBlock language={match[1]} code={codeString} />;
                  }

                  // Inline code
                  return (
                    <code
                      className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {reasoning}
            </ReactMarkdown>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
