import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Skeleton for a single chat message (user or assistant)
 */
export function ChatMessageSkeleton({
  isUser = false
}: {
  isUser?: boolean
}) {
  if (isUser) {
    return (
      <div className="space-y-2">
        <div className="ml-auto w-fit max-w-[85%] sm:max-w-[70%]">
          <Skeleton className="h-20 w-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Assistant avatar and name */}
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Message content */}
      <div className="max-w-[85%] space-y-2 sm:max-w-[70%]">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the entire messages area (multiple messages)
 */
export function ChatMessagesAreaSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pt-4 pb-4 sm:space-y-6 sm:pt-6">
      <ChatMessageSkeleton isUser={true} />
      <ChatMessageSkeleton isUser={false} />
      <ChatMessageSkeleton isUser={true} />
      <ChatMessageSkeleton isUser={false} />
    </div>
  );
}

/**
 * Skeleton for a single conversation item in the sidebar
 */
export function ConversationItemSkeleton() {
  return (
    <div className="flex items-center h-9 px-2 w-full gap-2">
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/**
 * Skeleton for the conversations list in sidebar
 */
export function ConversationsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 px-3 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a single RAG package item
 */
export function RagPackageItemSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the RAG packages list
 */
export function RagPackagesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <RagPackageItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for RAG package cards in dashboard (grid layout)
 */
export function RagPackageCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="space-y-2 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
      </div>

      <div className="flex-1 space-y-4 p-6">
        <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <Skeleton className="h-10 w-full rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for RAG dashboard package grid
 */
export function RagPackagesDashboardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <RagPackageCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for dashboard stats cards (main dashboard)
 */
export function DashboardStatsCardSkeleton() {
  return (
    <div className="h-full rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex h-full flex-col gap-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton for analytics card with progress bar
 */
export function AnalyticsCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton for analytics top lists (top RAGs, top users)
 */
export function AnalyticsTopListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="p-6 space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded border border-border p-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for team member card
 */
export function TeamMemberCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56" />
              <div className="flex gap-2 mt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded" />
            <Skeleton className="h-9 w-9 rounded" />
            <Skeleton className="h-9 w-9 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for team members list
 */
export function TeamMembersListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <TeamMemberCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for invitation link card
 */
export function InvitationLinkCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-full max-w-md rounded" />
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-9 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for invitation links list
 */
export function InvitationLinksListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <InvitationLinkCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for join request card
 */
export function JoinRequestCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-16 w-full rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded" />
            <Skeleton className="h-9 w-24 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for join requests list
 */
export function JoinRequestsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JoinRequestCardSkeleton key={i} />
      ))}
    </div>
  );
}

