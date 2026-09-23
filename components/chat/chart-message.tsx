'use client';

/**
 * Chart Message Component
 *
 * Displays AI-generated charts in the chat message flow.
 * Provides options to regenerate or use the chart data.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DataChart, type DataChartConfig, type ChartData } from '@/components/data/data-chart';
import { cn } from '@/lib/utils';

export interface ChartMessageData {
  /** Chart type */
  type: 'bar' | 'line' | 'pie' | 'scatter';
  /** Chart data */
  data: ChartData[];
  /** Chart configuration */
  config: Omit<DataChartConfig, 'type'>;
  /** AI's explanation for the chart */
  explanation?: string;
}

interface ChartMessageProps {
  /** Chart data and configuration */
  chart: ChartMessageData;
  /** Additional CSS class name */
  className?: string;
  /** Callback to regenerate chart */
  onRegenerate?: () => void;
  /** Callback to use chart data for new prompt */
  onUseData?: () => void;
  /** Whether the chart is expanded by default */
  defaultExpanded?: boolean;
}

/**
 * Chart message component for AI-generated charts.
 *
 * @example
 * ```tsx
 * <ChartMessage
 *   chart={{
 *     type: 'bar',
 *     data: [{ month: 'Jan', sales: 100 }, ...],
 *     config: { xAxis: 'month', yAxis: 'sales', title: 'Sales by Month' }
 *   }}
 * />
 * ```
 */
export function ChartMessage({
  chart,
  className,
  onRegenerate,
  onUseData,
  defaultExpanded = true,
}: ChartMessageProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fullConfig: DataChartConfig = {
    type: chart.type,
    ...chart.config,
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{chart.config.title || 'Chart'}</h2>
            <Button variant="outline" onClick={() => setIsFullscreen(false)}>
              Close
            </Button>
          </div>
          <DataChart
            data={chart.data}
            config={fullConfig}
            fullscreen
            onFullscreenToggle={() => setIsFullscreen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border border-border overflow-hidden', className)}
    >
      {/* Header */}
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm">
              {chart.config.title || `${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} Chart`}
            </span>
            {chart.data.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {chart.data.length} data points
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Action buttons */}
            {onRegenerate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                title="Regenerate chart"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
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
        <div className="p-4 space-y-4">
          {/* Explanation */}
          {chart.explanation && (
            <div className="text-sm text-muted-foreground">
              {chart.explanation}
            </div>
          )}

          {/* Chart */}
          <DataChart
            data={chart.data}
            config={fullConfig}
            onFullscreenToggle={() => setIsFullscreen(true)}
          />

          {/* Action buttons */}
          {onUseData && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={onUseData}
                className="gap-1"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Use this data
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
