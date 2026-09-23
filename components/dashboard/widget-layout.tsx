'use client';

import { useState, useCallback, createContext, useContext } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { GripVertical, X, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'list' | 'quick-access' | 'custom';
  size: 'small' | 'medium' | 'large';
  content: React.ReactNode;
  removable?: boolean;
  collapsible?: boolean;
}

interface WidgetContextType {
  widgets: DashboardWidget[];
  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  toggleWidgetCollapse: (id: string) => void;
  collapsedWidgets: Set<string>;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

function useWidgets() {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error('useWidgets must be used within WidgetProvider');
  }
  return context;
}

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [collapsedWidgets, setCollapsedWidgets] = useState<Set<string>>(new Set());

  const addWidget = useCallback((widget: DashboardWidget) => {
    setWidgets(prev => [...prev, widget]);
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  const reorderWidgets = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets(prev => {
      const newWidgets = [...prev];
      const [removed] = newWidgets.splice(fromIndex, 1);
      newWidgets.splice(toIndex, 0, removed);
      return newWidgets;
    });
  }, []);

  const toggleWidgetCollapse = useCallback((id: string) => {
    setCollapsedWidgets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  return (
    <WidgetContext.Provider
      value={{
        widgets,
        addWidget,
        removeWidget,
        reorderWidgets,
        toggleWidgetCollapse,
        collapsedWidgets,
      }}
    >
      {children}
    </WidgetContext.Provider>
  );
}

interface DraggableWidgetProps {
  widget: DashboardWidget;
  index: number;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function DraggableWidget({ widget, index, onDragStart, onDragEnd }: DraggableWidgetProps) {
  const { removeWidget, toggleWidgetCollapse, collapsedWidgets } = useWidgets();
  const y = useMotionValue(0);
  const scale = useTransform(y, [-100, 0, 100], [1.03, 1, 1.03]);
  const shadow = useTransform(
    y,
    [-100, 0, 100],
    ['0 5px 15px rgba(0,0,0,0.1)', '0 2px 8px rgba(0,0,0,0.1)', '0 5px 15px rgba(0,0,0,0.1)']
  );
  const isCollapsed = collapsedWidgets.has(widget.id);

  const handleDragEnd = (_: any, info: PanInfo) => {
    onDragEnd();
    const threshold = 50;
    if (Math.abs(info.offset.y) > threshold) {
      // Would trigger reorder in a full implementation
      console.log('Drag ended with offset:', info.offset.y);
    }
  };

  const getSizeClasses = () => {
    switch (widget.size) {
      case 'small':
        return 'col-span-1';
      case 'medium':
        return 'col-span-1 md:col-span-2';
      case 'large':
        return 'col-span-1 md:col-span-2 xl:col-span-3';
      default:
        return 'col-span-1';
    }
  };

  return (
    <motion.div
      layout
      style={{ y, scale, boxShadow: shadow }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      className={cn('relative', getSizeClasses())}
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors">
                <GripVertical className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {widget.collapsible && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => toggleWidgetCollapse(widget.id)}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              {widget.removable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => removeWidget(widget.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {!isCollapsed && (
          <CardContent>
            {widget.content}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

interface WidgetGridProps {
  className?: string;
}

export function WidgetGrid({ className }: WidgetGridProps) {
  const { widgets, reorderWidgets } = useWidgets();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggingIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  if (widgets.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-muted-foreground', className)}>
        <p className="text-sm">No widgets yet. Add some widgets to customize your dashboard.</p>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4', className)}>
      {widgets.map((widget, index) => (
        <DraggableWidget
          key={widget.id}
          widget={widget}
          index={index}
          onDragStart={() => handleDragStart(index)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
}

interface WidgetToolbarProps {
  availableWidgets: Omit<DashboardWidget, 'id'>[];
  className?: string;
}

export function WidgetToolbar({ availableWidgets, className }: WidgetToolbarProps) {
  const { addWidget } = useWidgets();
  const [isOpen, setIsOpen] = useState(false);

  const handleAddWidget = useCallback((widgetTemplate: Omit<DashboardWidget, 'id'>) => {
    const newWidget: DashboardWidget = {
      ...widgetTemplate,
      id: `widget-${Date.now()}-${Math.random()}`,
    };
    addWidget(newWidget);
    setIsOpen(false);
  }, [addWidget]);

  return (
    <div className={cn('relative', className)}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Widget
      </Button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 right-0 z-50 w-64 bg-background border border-border rounded-lg shadow-lg p-2"
        >
          <div className="space-y-1">
            {availableWidgets.map((widget, index) => (
              <button
                key={index}
                onClick={() => handleAddWidget(widget)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="text-sm font-medium">{widget.title}</div>
                <div className="text-xs text-muted-foreground capitalize">{widget.type}</div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Preset widget templates
export const widgetTemplates: Omit<DashboardWidget, 'id'>[] = [
  {
    title: 'Team Statistics',
    type: 'stat',
    size: 'medium',
    content: <div className="text-2xl font-bold">1,234</div>,
    removable: true,
    collapsible: true,
  },
  {
    title: 'Recent Activity',
    type: 'list',
    size: 'medium',
    content: <div className="space-y-2"><div className="text-sm">Activity 1</div><div className="text-sm">Activity 2</div></div>,
    removable: true,
    collapsible: true,
  },
  {
    title: 'Quick Actions',
    type: 'quick-access',
    size: 'small',
    content: <div className="flex gap-2"><Button size="sm">Action 1</Button><Button size="sm">Action 2</Button></div>,
    removable: false,
    collapsible: true,
  },
];
