// ErrorBoundary.tsx – גבול שגיאות React
// Class component שתופס שגיאות render של קומפוננטות ילדים.
// מציג fallback UI במקום crash של כל העמוד.
import { Component, ErrorInfo, ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-xl font-black">משהו השתבש</h2>
          <p className="text-sm text-muted-foreground">אירעה שגיאה בלתי צפויה. נסה לרענן את הדף.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
          >
            רענן דף
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
