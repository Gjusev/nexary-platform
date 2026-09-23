'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CategoryFilterProps {
    templates: any[];
    selectedCategory: string | null;
    onSelectCategory: (category: string | null) => void;
}

const categories = [
    { id: 'legal', name: 'Legal', icon: '⚖️' },
    { id: 'finance', name: 'Finanzas', icon: '📊' },
    { id: 'hr', name: 'RRHH', icon: '👥' },
    { id: 'sales', name: 'Ventas', icon: '🛒' },
    { id: 'tech', name: 'Tech', icon: '💻' },
    { id: 'support', name: 'Soporte', icon: '🎧' },
    { id: 'research', name: 'Investigación', icon: '📚' },
    { id: 'marketing', name: 'Marketing', icon: '📣' },
    { id: 'data', name: 'Datos', icon: '📈' },
    { id: 'project', name: 'Proyectos', icon: '📋' },
];

export function CategoryFilter({ templates, selectedCategory, onSelectCategory }: CategoryFilterProps) {
    const categoryCounts = templates.reduce((acc, template) => {
        acc[template.category] = (acc[template.category] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="flex flex-wrap gap-2">
            <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelectCategory(null)}
            >
                <Filter className="mr-2 h-4 w-4" />
                Todos
            </Button>

            {categories.map((category) => {
                const count = categoryCounts[category.id] || 0;
                if (count === 0) return null;

                const isSelected = selectedCategory === category.id;

                return (
                    <Button
                        key={category.id}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onSelectCategory(isSelected ? null : category.id)}
                    >
                        <span className="mr-1">{category.icon}</span>
                        {category.name}
                        <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                            {count}
                        </Badge>
                    </Button>
                );
            })}
        </div>
    );
}
