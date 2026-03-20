// packages/dashboard/src/components/ErrorBoundary.tsx
// React error boundary — catches uncaught render errors and shows a fallback UI.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-(--color-surface-root) text-(--color-text-primary)">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center text-sm text-(--color-text-secondary)">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded border border-(--color-border-default) bg-(--color-surface-raised) px-4 py-2 text-sm font-medium text-(--color-text-primary) transition-colors hover:bg-(--color-surface-overlay)"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
