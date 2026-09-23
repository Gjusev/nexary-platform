'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Calendar,
  FileText,
  User,
  Type,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  query: string;
  documentType?: string[];
  dateRange?: { start: string; end: string };
  author?: string[];
  fileFormat?: string[];
  packageIds?: string[];
  method?: 'hybrid' | 'semantic' | 'lexical';
  minScore?: number;
  limit?: number;
}

export interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void;
  availablePackages?: Array<{ id: string; name: string; documentCount?: number }>;
  availableDocumentTypes?: Array<{ value: string; label: string; count?: number }>;
  availableAuthors?: Array<{ value: string; label: string; count?: number }>;
  availableFormats?: Array<{ value: string; label: string }>;
  className?: string;
  defaultFilters?: Partial<SearchFilters>;
}

const DOCUMENT_TYPES = [
  { value: 'pdf', label: 'PDF Documents', count: 0 },
  { value: 'doc', label: 'Word Documents', count: 0 },
  { value: 'ppt', label: 'Presentations', count: 0 },
  { value: 'txt', label: 'Text Files', count: 0 },
  { value: 'csv', label: 'Spreadsheets', count: 0 },
];

const SEARCH_METHODS = [
  { value: 'hybrid', label: 'Hybrid (BM25 + Vector)', icon: Sparkles },
  { value: 'semantic', label: 'Semantic (Vector Only)', icon: Sparkles },
  { value: 'lexical', label: 'Lexical (BM25 Only)', icon: Search },
];

export function AdvancedSearch({
  onSearch,
  availablePackages = [],
  availableDocumentTypes = DOCUMENT_TYPES,
  availableAuthors = [],
  availableFormats = [],
  className,
  defaultFilters,
}: AdvancedSearchProps) {
  const t = useTranslations('search');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(defaultFilters?.query || '');
  const [filters, setFilters] = useState<SearchFilters>({
    query: defaultFilters?.query || '',
    dateRange: defaultFilters?.dateRange || { start: '', end: '' },
    documentType: defaultFilters?.documentType || [],
    author: defaultFilters?.author || [],
    fileFormat: defaultFilters?.fileFormat || [],
    packageIds: defaultFilters?.packageIds || [],
    method: defaultFilters?.method,
    minScore: defaultFilters?.minScore,
    limit: defaultFilters?.limit,
  });
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let count = 0;
    if (filters.documentType?.length) count++;
    if (filters.dateRange?.start || filters.dateRange?.end) count++;
    if (filters.author?.length) count++;
    if (filters.fileFormat?.length) count++;
    if (filters.packageIds?.length) count++;
    if (filters.minScore) count++;
    setActiveFilterCount(count);
  }, [filters]);

  const handleSearch = useCallback(() => {
    const searchFilters: SearchFilters = {
      ...filters,
      query: query.trim(),
    };
    onSearch(searchFilters);
    setIsOpen(false);
  }, [query, filters, onSearch]);

  const handleClearFilters = useCallback(() => {
    setFilters({ query: query.trim() });
    setQuery('');
  }, [query]);

  const toggleFilter = <K extends keyof SearchFilters>(
    key: K,
    value: string
  ) => {
    setFilters((prev) => {
      const currentArray = prev[key] as unknown as string[];
      if (currentArray?.includes(value as string)) {
        return {
          ...prev,
          [key]: currentArray.filter((item) => item !== value),
        };
      }
      return {
        ...prev,
        [key]: [...(currentArray || []), value],
      };
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={cn('w-full', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={t('searchPlaceholder') || 'Search documents...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10 pr-10 h-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'absolute right-10 top-1/2 -translate-y-1/2 h-6 w-6',
                activeFilterCount > 0 && 'text-primary'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <SlidersHorizontal className="h-3 w-3" />
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {t('advancedFilters') || 'Advanced Filters'}
              </h3>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleClearFilters}
                >
                  {t('clearAll') || 'Clear All'}
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {availablePackages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Type className="h-4 w-4 text-muted-foreground" />
                      {t('packages') || 'Packages'}
                      {(filters.packageIds?.length ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {filters.packageIds!.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {availablePackages.map((pkg) => (
                        <div key={pkg.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`pkg-${pkg.id}`}
                            checked={filters.packageIds?.includes(pkg.id)}
                            onCheckedChange={() => toggleFilter('packageIds', pkg.id)}
                          />
                          <label
                            htmlFor={`pkg-${pkg.id}`}
                            className="flex-1 text-sm cursor-pointer flex items-center justify-between"
                          >
                            <span>{pkg.name}</span>
                            {pkg.documentCount && (
                              <span className="text-xs text-muted-foreground">
                                {pkg.documentCount}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableDocumentTypes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {t('documentType') || 'Document Type'}
                      {(filters.documentType?.length ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {filters.documentType!.length}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableDocumentTypes.map((type) => (
                        <Badge
                          key={type.value}
                          variant={filters.documentType?.includes(type.value) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleFilter('documentType', type.value)}
                        >
                          {type.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    {t('searchMethod') || 'Search Method'}
                  </div>
                  <Select
                    value={filters.method || 'hybrid'}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, method: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEARCH_METHODS.map((method) => {
                        const Icon = method.icon;
                        return (
                          <SelectItem key={method.value} value={method.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {method.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {availableAuthors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {t('author') || 'Author'}
                      {(filters.author?.length ?? 0) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {filters.author!.length}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableAuthors.map((author) => (
                        <Badge
                          key={author.value}
                          variant={filters.author?.includes(author.value) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleFilter('author', author.value as any)}
                        >
                          {author.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {t('dateRange') || 'Date Range'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('from') || 'From'}</label>
                      <Input
                        type="date"
                        value={filters.dateRange?.start || ''}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: { start: e.target.value, end: prev.dateRange?.end ?? '' },
                          }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t('to') || 'To'}</label>
                      <Input
                        type="date"
                        value={filters.dateRange?.end || ''}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            dateRange: { start: prev.dateRange?.start ?? '', end: e.target.value },
                          }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      {t('minRelevance') || 'Min Relevance'}
                    </div>
                    {filters.minScore && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(filters.minScore * 100)}%
                      </Badge>
                    )}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={filters.minScore || 0}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, minScore: parseFloat(e.target.value) }))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {activeFilterCount} {t('activeFilters') || 'active filters'}
              </span>
              <Button onClick={handleSearch} size="sm" className="h-8">
                <Search className="h-3 w-3 mr-2" />
                {t('search') || 'Search'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
