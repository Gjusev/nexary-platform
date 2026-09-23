'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronDown, Sparkles, Info } from 'lucide-react';
import { PROVIDERS, getModelsByProvider, type AIProvider, type AIModel } from '@/lib/ai-providers';

interface ModelSelectorProps {
  provider: AIProvider;
  model: string;
  useSmartSelector: boolean;
  onProviderChange: (provider: AIProvider) => void;
  onModelChange: (model: string) => void;
  onSmartSelectorChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ModelSelector({
  provider,
  model,
  useSmartSelector,
  onProviderChange,
  onModelChange,
  onSmartSelectorChange,
  disabled = false,
}: ModelSelectorProps) {
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);

  // Update available models when provider changes
  useEffect(() => {
    const models = getModelsByProvider(provider);
    setAvailableModels(models);

    // If current model is not available in new provider, select first available model
    if (!models.find(m => m.id === model)) {
      const firstAvailable = models.find(m => m.isAvailable);
      if (firstAvailable) {
        onModelChange(firstAvailable.id);
      }
    }
  }, [provider, model, onModelChange]);

  const selectedProvider = PROVIDERS[provider];
  const selectedModel = availableModels.find(m => m.id === model);

  const handleProviderSelect = (newProvider: AIProvider) => {
    onProviderChange(newProvider);
    setShowProviderDropdown(false);
  };

  const handleModelSelect = (newModel: string) => {
    onModelChange(newModel);
    setShowModelDropdown(false);
  };

  const getProviderColor = (providerId: AIProvider) => {
    switch (providerId) {
      case 'openai':
        return 'text-blue-600 dark:text-blue-400';
      case 'gemini':
        return 'text-green-600 dark:text-green-400';
      case 'mistral':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPricingBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-foreground">🤖 AI Model</span>
        {useSmartSelector && (
          <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-primary/10 to-info/10 text-primary px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" />
            Smart
          </span>
        )}
      </div>

      {/* Provider Selector */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Provider
        </label>
        <button
          type="button"
          onClick={() => !disabled && setShowProviderDropdown(!showProviderDropdown)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted border border-border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={`font-medium ${getProviderColor(provider)}`}>
            {selectedProvider.name}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {showProviderDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {(Object.values(PROVIDERS) as unknown as import('@/lib/ai/types').ProviderConfig[]).map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => handleProviderSelect(prov.id)}
                disabled={!prov.isAvailable}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getProviderColor(prov.id)}`}>
                    {prov.name}
                  </span>
                  {!prov.isAvailable && (
                    <span className="text-xs text-muted-foreground">(Coming soon)</span>
                  )}
                </div>
                {provider === prov.id && <Check className="w-4 h-4 text-success" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model Selector */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Model
        </label>
        <button
          type="button"
          onClick={() => !disabled && setShowModelDropdown(!showModelDropdown)}
          disabled={disabled}
          className="w-full flex items-center justify-between px-3 py-2 bg-muted border border-border rounded-md text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {selectedModel?.name || model}
            </span>
            {selectedModel && selectedModel.pricingTier && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${getPricingBadgeColor(selectedModel.pricingTier)}`}>
                {selectedModel.pricingTier}
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>

        {showModelDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {availableModels.map((mdl) => (
              <button
                key={mdl.id}
                type="button"
                onClick={() => handleModelSelect(mdl.id)}
                disabled={!mdl.isAvailable}
                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {mdl.name}
                    </span>
                    {mdl.pricingTier && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getPricingBadgeColor(mdl.pricingTier)}`}>
                        {mdl.pricingTier}
                      </span>
                    )}
                  </div>
                  {model === mdl.id && <Check className="w-4 h-4 text-success" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {mdl.description}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {mdl.contextWindow.toLocaleString()} tokens
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Smart Selector Toggle */}
      <div className="pt-2 border-t border-border">
        <label className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={useSmartSelector}
                onChange={(e) => !disabled && onSmartSelectorChange(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-muted rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-primary peer-checked:to-info transition-all duration-200"></div>
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5 flex items-center justify-center">
                {useSmartSelector && <Sparkles className="w-2.5 h-2.5 text-primary" />}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                Smart Selector
              </div>
              <div className="text-xs text-muted-foreground">
                Auto-select best model for each task
              </div>
            </div>
          </div>
          <div className="group-hover:opacity-100 opacity-0 transition-opacity">
            <div className="relative">
              <Info className="w-4 h-4 text-muted-foreground" />
              <div className="absolute right-0 bottom-6 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-border">
                When enabled, the system analyzes your question and automatically selects the most suitable model based on task complexity, type, and requirements.
              </div>
            </div>
          </div>
        </label>
      </div>

      {/* Model Info */}
      {selectedModel && !useSmartSelector && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <div className="flex items-start gap-1">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Capabilities:</span>{' '}
              {selectedModel.capabilities?.slice(0, 3).join(', ') || 'General'}
              {(selectedModel.capabilities?.length || 0) > 3 && ` +${(selectedModel.capabilities?.length || 0) - 3} more`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
