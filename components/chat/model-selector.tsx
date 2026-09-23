'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronsUpDown, Sparkles, Info, Bot, Zap, Wind, Brain } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';

import { PROVIDERS, type AIProvider, type AIModel } from '@/lib/ai-providers';

interface ChatModelSelectorProps {
    selectedProvider: AIProvider;
    selectedModel: string;
    useSmartSelector: boolean;
    onProviderChange: (provider: AIProvider) => void;
    onModelChange: (model: string) => void;
    onSmartSelectorChange: (enabled: boolean) => void;
    className?: string;
}

const PROVIDER_ICONS: Record<AIProvider, React.ReactNode> = {
    openai: <Bot className="h-3.5 w-3.5" />,
    gemini: <Sparkles className="h-3.5 w-3.5" />,
    mistral: <Wind className="h-3.5 w-3.5" />,
    anthropic: <Brain className="h-3.5 w-3.5" />,
    "aleph-alpha": <Zap className="h-3.5 w-3.5" />,
};

export function ChatModelSelector({
    selectedProvider,
    selectedModel,
    useSmartSelector,
    onProviderChange,
    onModelChange,
    onSmartSelectorChange,
    className,
}: ChatModelSelectorProps) {
    const t = useTranslations('chat.modelSelector');
    const [open, setOpen] = React.useState(false);

    // Helper to find the current model object
    const currentModel = React.useMemo(() => {
        if (useSmartSelector) return null;
        const providerConfig = PROVIDERS[selectedProvider];
        return providerConfig?.models.find((m) => m.id === selectedModel);
    }, [selectedProvider, selectedModel, useSmartSelector]);

    const handleSelectModel = (providerId: string, modelId: string) => {
        onSmartSelectorChange(false);
        onProviderChange(providerId as AIProvider);
        onModelChange(modelId);
        setOpen(false);
    };

    const handleSelectSmart = () => {
        onSmartSelectorChange(true);
        setOpen(false);
    };

    const getPricingBadgeColor = (tier: string = 'low') => {
        switch (tier) {
            case 'free': return 'bg-green-500/10 text-green-500 hover:bg-green-500/20';
            case 'low': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
            case 'medium': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
            case 'high': return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    size="sm"
                    className={cn(
                        "h-7 w-auto justify-between gap-1 rounded-lg px-2 text-xs font-normal hover:bg-accent hover:text-foreground",
                        className
                    )}
                >
                    {useSmartSelector ? (
                        <>
                            <Brain className="mr-1 h-3.5 w-3.5 text-primary" />
                            <span className="truncate">Auto / Smart</span>
                        </>
                    ) : (
                        <>
                            <span className="mr-1 text-muted-foreground">
                                {PROVIDER_ICONS[selectedProvider] || <Bot className="h-3.5 w-3.5" />}
                            </span>
                            <span className="truncate font-medium">{currentModel?.name || selectedModel}</span>
                        </>
                    )}
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start" side="top">
                <Command>
                    <CommandInput placeholder={t('searchPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>No model found.</CommandEmpty>

                        {/* Smart Selector Option */}
                        <CommandGroup heading="Auto">
                            <CommandItem
                                value="auto-smart-selector"
                                onSelect={handleSelectSmart}
                                className="text-xs"
                            >
                                <div className="flex items-center gap-2 w-full">
                                    <Brain className={cn(
                                        "h-4 w-4",
                                        useSmartSelector ? "text-primary" : "text-muted-foreground"
                                    )} />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{t('smartSelector')}</span>
                                        <span className="text-[10px] text-muted-foreground">{t('smartSelectorDesc')}</span>
                                    </div>
                                    {useSmartSelector && (
                                        <Check className="ml-auto h-4 w-4 text-primary" />
                                    )}
                                </div>
                            </CommandItem>
                        </CommandGroup>

                        <CommandSeparator />

                        {/* Provider Groups */}
                        {(Object.values(PROVIDERS) as unknown as import('@/lib/ai/types').ProviderConfig[]).map((provider) => (
                            <CommandGroup key={provider.id} heading={provider.name}>
                                {provider.models.map((model) => {
                                    const isSelected = !useSmartSelector && selectedModel === model.id;

                                    return (
                                        <HoverCard key={model.id} openDelay={200} closeDelay={100}>
                                            <HoverCardTrigger asChild>
                                                <CommandItem
                                                    value={`${provider.id}-${model.id}`} // Unique value for searching
                                                    keywords={[model.name, provider.name, model.id]}
                                                    onSelect={() => handleSelectModel(provider.id, model.id)}
                                                    disabled={!model.isAvailable}
                                                    className="text-xs cursor-pointer aria-selected:bg-accent"
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(isSelected && "font-medium")}>{model.name}</span>
                                                            {model.pricingTier && (
                                                                <span className={cn(
                                                                    "px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold",
                                                                    getPricingBadgeColor(model.pricingTier)
                                                                )}>
                                                                    {model.pricingTier}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                                                    </div>
                                                </CommandItem>
                                            </HoverCardTrigger>
                                            <HoverCardContent side="right" align="start" className="w-[280px] p-3">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-sm font-semibold">{model.name}</h4>
                                                        <Badge variant="outline" className="text-[10px] h-5">{provider.name}</Badge>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground">
                                                        {model.description || "No description available."}
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-muted-foreground font-medium">{t('contextWindow')}</span>
                                                            <span>{model.contextWindow.toLocaleString()} tokens</span>
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-muted-foreground font-medium">{t('pricing')}</span>
                                                            <span className="capitalize">{model.pricingTier || 'Unknown'}</span>
                                                        </div>
                                                    </div>

                                                    {model.capabilities && model.capabilities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {model.capabilities.map((cap) => (
                                                                <Badge key={cap} variant="secondary" className="text-[10px] bg-muted/50 px-1.5 h-5 font-normal">
                                                                    {cap}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </HoverCardContent>
                                        </HoverCard>
                                    );
                                })}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
