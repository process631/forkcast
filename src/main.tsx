import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadLibrary } from './lib/mealdb';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Warm up the recipe library in the background so results appear instantly after the wizard.
const warm = () => void loadLibrary().catch(() => undefined);
if ('requestIdleCallback' in window) window.requestIdleCallback(warm);
else setTimeout(warm, 500);
