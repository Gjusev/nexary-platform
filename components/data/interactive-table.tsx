'use client';

/**
 * Interactive Table Component
 *
 * Displays tabular data with sorting, filtering, and pagination.
 * Supports various data types (strings, numbers, dates, booleans).
 */

import { useState, useMemo, useEffect } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface InteractiveTableProps {
  /** Array of data objects */
  data: Array<Record<string, string | number | boolean | Date | null>>;
  /** Column headers (keys from data objects) */
  headers: string[];
  /** Enable sorting functionality */
  sortable?: boolean;
  /** Enable filtering functionality */
  filterable?: boolean;
  /** Enable search functionality */
  searchable?: boolean;
  /** Number of rows per page */
  pageSize?: number;
  /** Additional CSS class name */
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortState = { column: string | null; direction: SortDirection };

/**
 * Interactive table component with sorting, filtering, pagination, and search.
 *
 * @example
 * ```tsx
 * <InteractiveTable
 *   data={[{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]}
 *   headers={['name', 'age']}
 *   sortable
 *   filterable
 *   searchable
 *   pageSize={10}
 * />
 * ```
 */
export function InteractiveTable({
  data,
  headers,
  sortable = true,
  filterable = true,
  searchable = true,
  pageSize = 10,
  className,
}: InteractiveTableProps) {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: null });
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Get unique values for a column (for filter dropdown)
  const getColumnUniqueValues = (column: string): string[] => {
    const values = data.map((row) => row[column]);
    const uniqueValues = Array.from(new Set(values)).filter((v) => v !== null && v !== undefined && v !== '');
    return uniqueValues.map(String).sort();
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortState.column!];
      const bValue = b[sortState.column!];

      // Handle null/undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Sort by type
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortState.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortState.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortState.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortState]);

  // Filter data by column
  const filteredData = useMemo(() => {
    let result = sortedData;

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, value]) => {
      if (value) {
        result = result.filter((row) => {
          const cellValue = row[column];
          return String(cellValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) => {
        return headers.some((header) => {
          const cellValue = row[header];
          return cellValue != null && String(cellValue).toLowerCase().includes(query);
        });
      });
    }

    return result;
  }, [sortedData, columnFilters, searchQuery, headers]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  // Reset to page 1 when filters/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [Object.keys(columnFilters).length, searchQuery, sortState.column, sortState.direction]);

  // Handle sort
  const handleSort = (column: string) => {
    if (!sortable) return;

    setSortState((prev) => {
      if (prev.column === column) {
        // Cycle: asc -> desc -> null
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        } else if (prev.direction === 'desc') {
          return { column: null, direction: null };
        }
      }
      return { column, direction: 'asc' };
    });
  };

  // Handle column filter change
  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [column]: value }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setColumnFilters({});
    setSearchQuery('');
    setSortState({ column: null, direction: null });
  };

  // Format cell value for display
  const formatCellValue = (value: string | number | boolean | Date | null): string => {
    if (value == null) return '-';
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  };

  // Get cell value type for styling
  const getCellType = (value: string | number | boolean | Date | null): 'number' | 'date' | 'boolean' | 'string' => {
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  };

  const hasActiveFilters = Object.values(columnFilters).some((v) => v) || searchQuery;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Bar */}
      {searchable && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search in all columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {paginatedData.length} of {filteredData.length} results
          {filteredData.length !== data.length && ` (filtered from ${data.length} total)`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header} className="min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      {/* Header with sort */}
                      <div className="flex items-center gap-1">
                        {sortable ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 font-medium"
                            onClick={() => handleSort(header)}
                          >
                            <span className="truncate max-w-[150px]">{header}</span>
                            {sortState.column === header ? (
                              sortState.direction === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        ) : (
                          <span className="font-medium truncate">{header}</span>
                        )}
                      </div>

                      {/* Column filter */}
                      {filterable && (
                        <Select
                          value={columnFilters[header] || ''}
                          onValueChange={(value) => handleFilterChange(header, value)}
                        >
                          <SelectTrigger className="h-6 text-xs w-full">
                            <SelectValue placeholder="Filter..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All values</SelectItem>
                            {getColumnUniqueValues(header).slice(0, 50).map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={headers.length} className="text-center py-8 text-muted-foreground">
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {headers.map((header) => {
                      const value = row[header];
                      const cellType = getCellType(value);

                      return (
                        <TableCell key={header}>
                          {cellType === 'boolean' ? (
                            <Badge variant={value ? 'default' : 'secondary'} className="font-normal">
                              {formatCellValue(value)}
                            </Badge>
                          ) : cellType === 'number' ? (
                            <span className="font-mono">{formatCellValue(value)}</span>
                          ) : (
                            <span className="truncate block max-w-[200px]" title={formatCellValue(value)}>
                              {formatCellValue(value)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
