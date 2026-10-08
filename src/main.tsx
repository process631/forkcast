import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadLibrary } from './lib/mealdb';
import { idbClear } from './lib/storage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The AI features were removed: forget anything they stored (including any saved Gemini key).
try {
  localStorage.removeItem('forkcast.settings');
  localStorage.removeItem('forkcast.aiRecipes');
  sessionStorage.removeItem('forkcast.ideas');
} catch {
  // storage blocked; nothing to clean
}
void idbClear('img:');
void idbClear('photo:');

// Warm up the recipe library in the background so results appear instantly after the wizard.
const warm = () => void loadLibrary().catch(() => undefined);
if ('requestIdleCallback' in window) window.requestIdleCallback(warm);
else setTimeout(warm, 500);
