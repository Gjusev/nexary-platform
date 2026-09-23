'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, Sparkles, Heart } from 'lucide-react';
import { useUser } from '@stackframe/stack';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TemplateCard } from '@/components/marketplace/template-card';
import { CategoryFilter } from '@/components/marketplace/category-filter';
import { Skeleton } from '@/components/ui/skeleton';

interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    usage_count: number;
    is_featured: boolean;
    is_favorited?: boolean;
}

export default function MarketplacePage() {
    const user = useUser({ or: 'return-null' });
    const [templates, setTemplates] = useState<Template[]>([]);
    const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTemplates();
    }, []);

    useEffect(() => {
        filterTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templates, selectedCategory, searchQuery]);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates);
            }
        } catch (error) {
            console.error('[Marketplace] Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterTemplates = () => {
        let filtered = [...templates];

        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.name.toLowerCase().includes(query) ||
                t.description?.toLowerCase().includes(query)
            );
        }

        setFilteredTemplates(filtered);
    };

    const featuredTemplates = templates.filter(t => t.is_featured);
    const regularTemplates = filteredTemplates.filter(t => !t.is_featured);

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="mb-8 space-y-4">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold">Template Marketplace</h1>
                        <p className="text-muted-foreground mt-1">
                            Asistentes especializados listos para usar
                        </p>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <CategoryFilter
                        templates={templates}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                    />
                </div>
            </div>

            {/* Featured Section */}
            {featuredTemplates.length > 0 && !selectedCategory && !searchQuery && (
                <div className="mb-12">
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Destacados
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {featuredTemplates.map((template) => (
                            <TemplateCard key={template.id} template={template} onUpdate={fetchTemplates} />
                        ))}
                    </div>
                </div>
            )}

            {/* All Templates */}
            <div>
                <h2 className="text-2xl font-semibold mb-4">
                    {selectedCategory ? `Categoría: ${selectedCategory}` : 'Todos los Templates'}
                    <span className="text-sm text-muted-foreground ml-2">
                        ({filteredTemplates.length})
                    </span>
                </h2>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-64" />
                        ))}
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">No se encontraron templates</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTemplates.map((template) => (
                            <TemplateCard key={template.id} template={template} onUpdate={fetchTemplates} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
