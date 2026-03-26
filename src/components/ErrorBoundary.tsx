import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, recoverFromChunkError } from "@/lib/chunkErrorRecovery";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recovering: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    if (isChunkLoadError(error)) {
      this.setState({ recovering: true });
      recoverFromChunkError().then((willReload) => {
        if (!willReload) {
          this.setState({ recovering: false });
        }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // While recovery reload is in progress, show spinner
      if (this.state.recovering) {
        return (
          <div className="flex min-h-svh items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        );
      }

      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Qualcosa è andato storto</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message || "Errore imprevisto"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
          >
            Ricarica
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
