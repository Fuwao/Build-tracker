import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/variables.css';
import './styles/components.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { repository } from './repository';

// 初回起動時のみテストデータを投入してからアプリを描画する
(async () => {
  try {
    await repository.ensureSeeded();
  } catch (e) {
    console.error('初期データの投入に失敗しました', e);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
})();
