import { useEffect, useState } from 'react';
import { readJSON, writeJSON } from './storage';

export type Theme = 'system' | 'light' | 'dark';

/** Light / dark / follow-the-system theme, remembered between visits. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => readJSON<Theme>('forkcast.theme', 'system'));
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    writeJSON('forkcast.theme', theme);
  }, [theme]);
  const cycle = () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'));
  return [theme, cycle];
}
