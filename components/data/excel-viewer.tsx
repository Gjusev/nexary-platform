'use client';

/**
 * Excel Viewer Component
 *
 * Displays Excel workbooks with multiple sheets as interactive tables.
 * Provides analysis prompts for AI integration.
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileSpreadsheet,
  Table,
  Sparkles,
  Download,
  TrendingUp,
  BarChart3,
  PieChart,
  Eye,
} from 'lucide-react';
import { InteractiveTable } from '@/components/data/interactive-table';
import type { ExcelWorkbookData, ExcelSheetData } from '@/lib/rag/text-extract';
import { cn } from '@/lib/utils';

interface ExcelViewerProps {
  /** Workbook data from extractExcelWorkbook() */
  workbookData: ExcelWorkbookData;
  /** Original filename */
  filename: string;
  /** Callback when user requests AI analysis */
  onAnalyze?: (sheetName: string, analysisType: 'summary' | 'patterns' | 'chart') => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Excel viewer component with multi-sheet support and AI analysis integration.
 *
 * @example
 * ```tsx
 * <ExcelViewer
 *   workbookData={workbookData}
 *   filename="sales.xlsx"
 *   onAnalyze={(sheet, type) => analyzeSheet(sheet, type)}
 * />
 * ```
 */
export function ExcelViewer({
  workbookData,
  filename,
  onAnalyze,
  className,
}: ExcelViewerProps) {
  const [activeSheet, setActiveSheet] = useState<string>(
    workbookData.sheets[0]?.name || ''
  );

  if (!workbookData.sheets || workbookData.sheets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No data available in this Excel file
        </CardContent>
      </Card>
    );
  }

  const currentSheet = workbookData.sheets.find((s) => s.name === activeSheet) || workbookData.sheets[0];

  // Get column info for analysis suggestions
  const getColumnInfo = (sheet: ExcelSheetData) => {
    return sheet.headers.map((header) => {
      const sampleValues = sheet.data.slice(0, 5).map((row) => row[header]);
      const types = new Set(sampleValues.map((v) => typeof v));
      const hasNumbers = types.has('number');
      const hasDates = sampleValues.some((v) => v instanceof Date);

      return {
        name: header,
        hasNumbers,
        hasDates,
        sampleValues: sampleValues.slice(0, 3),
      };
    });
  };

  const columnInfo = getColumnInfo(currentSheet);
  const numericColumns = columnInfo.filter((c) => c.hasNumbers);

  // Export to CSV
  const exportToCSV = (sheet: ExcelSheetData) => {
    const headers = sheet.headers.join(',');
    const rows = sheet.data.map((row) =>
      sheet.headers.map((h) => {
        const val = row[h];
        if (val == null) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return String(val);
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{filename}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <span>{workbookData.sheets.length} sheet{workbookData.sheets.length > 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{workbookData.sheets.reduce((sum, s) => sum + s.rowCount, 0).toLocaleString()} rows</span>
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(currentSheet)}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeSheet} onValueChange={setActiveSheet} className="w-full">
          {/* Sheet Tabs */}
          <TabsList className="mb-4 w-full justify-start overflow-x-auto">
            {workbookData.sheets.map((sheet) => (
              <TabsTrigger
                key={sheet.name}
                value={sheet.name}
                className="gap-1 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-900 dark:data-[state=active]:text-emerald-100"
              >
                <Table className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">{sheet.name}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {sheet.rowCount}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Sheet Content */}
          {workbookData.sheets.map((sheet) => (
            <TabsContent key={sheet.name} value={sheet.name} className="space-y-4">
              {/* AI Analysis Prompt */}
              {onAnalyze && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-sm">Ask AI about this data</h4>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAnalyze(sheet.name, 'summary')}
                      className="gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Summarize
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAnalyze(sheet.name, 'patterns')}
                      className="gap-1"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Find patterns
                    </Button>

                    {numericColumns.length >= 2 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAnalyze(sheet.name, 'chart')}
                        className="gap-1"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        Create chart
                      </Button>
                    )}
                  </div>

                  {/* Column info preview */}
                  <div className="mt-3 text-xs text-muted-foreground">
                    <span>Columns: </span>
                    {sheet.headers.slice(0, 5).map((h, i) => (
                      <Badge key={h} variant="secondary" className="mr-1">
                        {h}
                      </Badge>
                    ))}
                    {sheet.headers.length > 5 && (
                      <span>+{sheet.headers.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Interactive Table */}
              <InteractiveTable
                data={sheet.data}
                headers={sheet.headers}
                sortable
                filterable
                searchable
                pageSize={25}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
