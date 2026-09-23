import { Loader2 } from 'lucide-react';

export default function ChatLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm dark:bg-card/60 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-card-foreground">
              Loading Chat...
            </h1>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    </div>
  );
}
