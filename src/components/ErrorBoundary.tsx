/**
 * FILE: ErrorBoundary.tsx
 * ROLE IN KULA: The "Safety Net" — catches any uncaught render error anywhere
 * in the component tree so a single crash shows a warm recovery screen
 * instead of a white screen of death.
 *
 * MOUNTED BY: main.tsx, wrapping <App /> at the very root.
 *
 * NOTE: Error boundaries must be class components — React provides no hook
 * equivalent for getDerivedStateFromError/componentDidCatch.
 */
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('[KULA ERROR BOUNDARY] Uncaught render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-stone-50 p-8 text-center">
          <div className="max-w-sm space-y-5">
            <div className="text-5xl">🪴</div>
            <h1 className="serif text-2xl text-stone-800">Something got tangled</h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              An unexpected error interrupted KULA. Your data is safe — a quick
              reload usually clears it up.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-brand text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:opacity-90 transition-opacity"
            >
              Reload KULA
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
