/**
 * Suprime warnings de hidratación causados por extensiones del navegador
 * Estos warnings son conocidos y no afectan la funcionalidad
 */

if (typeof window !== 'undefined') {
  // Suprimir warnings de extensiones del navegador
  const originalError = console.error;
  console.error = (...args) => {
    const message = args[0]?.toString() || '';
    
    // Ignorar warnings de hidratación causados por extensiones
    if (
      message.includes('Hydration') ||
      message.includes('did not match') ||
      message.includes('ct-shortcut') ||
      message.includes('browser extension')
    ) {
      return;
    }
    
    originalError.apply(console, args);
  };

  // Suprimir warnings de React sobre hidratación
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    
    if (
      message.includes('Hydration') ||
      message.includes('did not match') ||
      message.includes('Extra attributes')
    ) {
      return;
    }
    
    originalWarn.apply(console, args);
  };
}

export {};
