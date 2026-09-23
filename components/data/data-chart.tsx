'use client';

/**
 * Data Chart Component
 *
 * Displays various chart types (bar, line, pie, scatter) using Recharts.
 * Provides responsive sizing and export functionality.
 */

import { useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartConfig, ChartTooltip } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

export interface ChartData {
  [key: string]: string | number | null;
}

export interface DataChartConfig {
  /** Chart type */
  type: ChartType;
  /** Column to use for X-axis (categories) */
  xAxis: string;
  /** Column(s) to use for Y-axis (values) */
  yAxis: string | string[];
  /** Chart title */
  title?: string;
  /** Chart description */
  description?: string;
  /** Color palette for data series */
  colors?: string[];
  /** Enable stacking for bar/line charts */
  stacked?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
}

interface DataChartProps {
  /** Array of data objects */
  data: ChartData[];
  /** Chart configuration */
  config: DataChartConfig;
  /** Additional CSS class name */
  className?: string;
  /** Enable fullscreen mode */
  fullscreen?: boolean;
  /** On fullscreen toggle callback */
  onFullscreenToggle?: () => void;
}

// Default color palette
const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// Recharts chart colors
const RECHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
];

/**
 * Data chart component supporting multiple chart types.
 *
 * @example
 * ```tsx
 * <DataChart
 *   data={[{ month: 'Jan', sales: 100, profit: 20 }, ...]}
 *   config={{
 *     type: 'bar',
 *     xAxis: 'month',
 *     yAxis: ['sales', 'profit'],
 *     title: 'Monthly Performance'
 *   }}
 * />
 * ```
 */
export function DataChart({
  data,
  config,
  className,
  fullscreen = false,
  onFullscreenToggle,
}: DataChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const {
    type,
    xAxis,
    yAxis,
    title,
    description,
    colors = DEFAULT_COLORS,
    stacked = false,
    showLegend = true,
    showGrid = true,
  } = config;

  // Prepare chart config for Recharts
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis];

  // Build chart config for ChartContainer
  const chartConfig: ChartConfig = {};
  yAxes.forEach((axis, index) => {
    chartConfig[axis] = {
      label: axis,
      color: RECHART_COLORS[index % RECHART_COLORS.length],
    };
  });

  // Download chart as PNG
  const downloadChart = async () => {
    const svgElement = chartRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = svgElement.clientWidth * 2;
      canvas.height = svgElement.clientHeight * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${title || 'chart'}.png`;
      downloadLink.click();
    };

    img.src = url;
  };

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxis} />
            <YAxis />
            <ChartTooltip content={<ChartTooltip />} />
            {showLegend && <Legend />}
            {yAxes.map((axis, index) => (
              <Bar
                key={axis}
                dataKey={axis}
                fill={RECHART_COLORS[index % RECHART_COLORS.length]}
                stackId={stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxis} />
            <YAxis />
            <ChartTooltip content={<ChartTooltip />} />
            {showLegend && <Legend />}
            {yAxes.map((axis, index) => (
              <Line
                key={axis}
                type="monotone"
                dataKey={axis}
                stroke={RECHART_COLORS[index % RECHART_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: RECHART_COLORS[index % RECHART_COLORS.length] }}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        // For pie charts, use the first Y axis as the data and the X axis as labels
        const pieData = data.map((item) => ({
          name: item[xAxis],
          value: item[yAxes[0]],
        }));

        return (
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => `${entry.name}: ${entry.value}`}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={RECHART_COLORS[index % RECHART_COLORS.length]}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltip />} />
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxis} type="category" />
            <YAxis dataKey={yAxes[0]} />
            <ChartTooltip content={<ChartTooltip />} />
            <Scatter
              data={data}
              fill={RECHART_COLORS[0]}
            />
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn('', className)}>
      {(title || description || onFullscreenToggle) && (
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={downloadChart}
                title="Download as PNG"
              >
                <Download className="h-4 w-4" />
              </Button>
              {onFullscreenToggle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onFullscreenToggle}
                  title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent ref={chartRef}>
        <ChartContainer config={chartConfig}>
          {renderChart() || (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Unsupported chart type
            </div>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
