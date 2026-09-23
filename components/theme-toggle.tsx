"use client";

import { useEffect, useState } from 'react';
import { Moon, Sun, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useUser } from '@stackframe/stack';
import { Button } from '@/components/ui/button';
import { persistThemePreference } from '@/lib/theme-storage';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const user = useUser({ or: 'return-null' });

  useEffect(() => {
    setMounted(true);
  }, []);

  const switchTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light';

    // Aplicar el tema inmediatamente
    setTheme(nextTheme);
    persistThemePreference(nextTheme);

    // Si el usuario está autenticado, guardar en los metadatos
    if (user) {
      try {
        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: nextTheme }),
        });

        if (!response.ok) {
          throw new Error('Error al guardar preferencias');
        }
      } catch (error) {
        console.error('Error al sincronizar tema con metadatos:', error);
        // No mostramos toast de error para no interrumpir la UX
      }
    }
  };

  const toggle = () => {
    // Use View Transitions API if available
    if (!document.startViewTransition) {
      switchTheme();
      return;
    }

    document.startViewTransition(async () => {
      await switchTheme();
    });
  };

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Cambiar tema" disabled>
          <Sun className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Theme Toggle Button */}
      <Button variant="outline" size="icon" onClick={toggle} aria-label="Cambiar tema">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
