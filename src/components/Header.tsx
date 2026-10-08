import { aiEnabled, appMode, cookbookStore, settingsStore, useStore } from '../lib/store';
import { useTheme, type Theme } from '../lib/theme';
import { href } from '../router';

const THEME_ICON: Record<Theme, string> = { system: '🌓', light: '☀️', dark: '🌙' };

export function Header({ route }: { route: string }) {
  const [theme, cycleTheme] = useTheme();
  const settings = useStore(settingsStore);
  const { saved } = useStore(cookbookStore);
  const ai = aiEnabled(settings) || appMode(settings);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href={href('/')} className="logo" aria-label="Forkcast home">
          <span className="logo-mark" aria-hidden="true">🍴</span>
          <span className="logo-text">Forkcast</span>
        </a>
        <nav className="header-nav">
          <a href={href('/plan')} className={`nav-link${route === 'plan' ? ' active' : ''}`}>
            <span aria-hidden="true">✨</span> <span className="hide-sm">Decide</span>
          </a>
          <a href={href('/cookbook')} className={`nav-link${route === 'cookbook' ? ' active' : ''}`}>
            <span aria-hidden="true">📖</span> <span className="hide-sm">Cookbook</span>
            {saved.length > 0 && <span className="badge">{saved.length}</span>}
          </a>
          <a href={href('/settings')} className={`nav-link${route === 'settings' ? ' active' : ''}`} title={ai ? 'AI chef is on' : 'Connect Gemini for AI ideas & photos'}>
            <span aria-hidden="true">⚙️</span> <span className="hide-sm">Settings</span>
            <span className={`dot ${ai ? 'dot-on' : 'dot-off'}`} aria-label={ai ? 'AI on' : 'AI off'} />
          </a>
          <button type="button" className="icon-btn" onClick={cycleTheme} aria-label={`Theme: ${theme}. Click to change.`} title={`Theme: ${theme}`}>
            {THEME_ICON[theme]}
          </button>
        </nav>
      </div>
    </header>
  );
}
