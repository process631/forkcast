import { useEffect } from 'react';
import { CookMode } from './components/CookMode';
import { Cookbook } from './components/Cookbook';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { RecipePage } from './components/RecipePage';
import { Results } from './components/Results';
import { Settings } from './components/Settings';
import { TimerTray } from './components/Timers';
import { Wizard } from './components/Wizard';
import { href, useRoute } from './router';

export function App() {
  const [page = '', ...params] = useRoute();
  const path = params.join('/');

  useEffect(() => {
    if (page !== 'cook') window.scrollTo(0, 0);
  }, [page, path]);

  if (page === 'cook' && params[0]) {
    return (
      <>
        <CookMode id={params[0]} step={params[1]} />
        <TimerTray />
      </>
    );
  }

  let content;
  switch (page) {
    case '':
      content = <Home />;
      break;
    case 'plan':
      content = <Wizard params={params} />;
      break;
    case 'results':
      content = <Results />;
      break;
    case 'recipe':
      content = <RecipePage key={params[0]} id={params[0]} />;
      break;
    case 'cookbook':
      content = <Cookbook />;
      break;
    case 'settings':
      content = <Settings />;
      break;
    default:
      content = (
        <div className="container page empty">
          <div className="empty-emoji">🥄</div>
          <h1>This page wandered off</h1>
          <a href={href('/')} className="btn btn-primary">
            Go home
          </a>
        </div>
      );
  }

  return (
    <>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header route={page} />
      <main id="main" tabIndex={-1}>
        {content}
      </main>
      <footer className="site-footer no-print">
        <div className="container">
          Made with 🍴 by Forkcast · Recipes from TheMealDB · AI by Google Gemini (optional)
        </div>
      </footer>
      <TimerTray />
    </>
  );
}
