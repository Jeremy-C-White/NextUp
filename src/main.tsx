import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './lib/theme';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }
class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <p className="text-red-400 mb-2 font-bold">Something went wrong.</p>
          <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm break-words">
            {this.state.error?.message || this.state.error?.toString()}
          </p>
          <div className="flex flex-wrap gap-4 justify-center max-w-md">
            <button 
              onClick={() => window.location.reload()}
              className="bg-orange-500 text-slate-950 font-bold px-6 py-3 rounded-xl"
            >
              Reload
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-bold px-6 py-3 rounded-xl"
            >
              Clear Data
            </button>
            <button 
              onClick={async () => {
                await signOut(auth);
                window.location.reload();
              }}
              className="bg-red-500/10 text-red-500 font-bold px-6 py-3 rounded-xl"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="app-theme">
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
