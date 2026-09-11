'use client';

import React from 'react';
import { useTheme } from '@payloadcms/ui';

/**
 * Theme bridge (plan Analytics+CRM shadcn, PR 1):
 * Payload persiste el tema por usuario (light/dark/auto desde su cuenta,
 * admin.theme: 'all' por defecto) y expone useTheme() a las vistas custom.
 * Este puente aplica la clase `.dark` al contenedor de la vista para que los
 * tokens semánticos de shadcn (.dark en globals.css) flippen con el shell.
 *
 * autoMode = true significa "seguir al sistema": se resuelve con
 * matchMedia. El bridge es un div transparente — no afecta layout.
 */
export function ThemeBridge({ children }: { children: React.ReactNode }) {
  const { theme, autoMode } = useTheme();
  const [systemDark, setSystemDark] = React.useState(false);

  React.useEffect(() => {
    if (!autoMode) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [autoMode]);

  const effective = autoMode ? (systemDark ? 'dark' : 'light') : theme;

  return <div className={effective === 'dark' ? 'dark' : undefined}>{children}</div>;
}
