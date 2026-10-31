import { cookbookStore, useStore } from '../lib/store';
import { useTheme, type Theme } from '../lib/theme';
import { href } from '../router';

const THEME_ICON: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

export function Header({ route }: { route: string }) {
  const [theme, cycleTheme] = useTheme();
  const { saved } = useStore(cookbookStore);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href={href('/')} className="logo" aria-label="Forkcast home">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64">
              <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                <path d="M22 12v14a6 6 0 0 0 12 0V12M28 12v40" />
                <path d="M44 12c-5 3-7 10-7 18h7v22" />
              </g>
            </svg>
          </span>
          <span className="logo-text">Forkcast</span>
        </a>
        <nav className="header-nav" aria-label="Primary">
          <a href={href('/plan')} className={`nav-link${route === 'plan' ? ' active' : ''}`} aria-current={route === 'plan' ? 'page' : undefined}>
            Decide
          </a>
          <a href={href('/cookbook')} className={`nav-link${route === 'cookbook' ? ' active' : ''}`} aria-current={route === 'cookbook' ? 'page' : undefined}>
            Cookbook
            {saved.length > 0 && <span className="badge">{saved.length}</span>}
          </a>
          <a href={href('/settings')} className={`nav-link${route === 'settings' ? ' active' : ''}`} aria-current={route === 'settings' ? 'page' : undefined}>
            Settings
          </a>
          <button type="button" className="btn btn-ghost btn-sm theme-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Activate to change.`} title={`Theme: ${theme}`}>
            {THEME_ICON[theme]}
          </button>
        </nav>
      </div>
    </header>
  );
}
