import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the current route) clears the error, so navigating away recovers. */
  resetKey?: string;
}

/**
 * Catches rendering errors so one broken screen shows a message instead of a blank white page. The menu stays usable;
 * "Try again" re-renders the screen, "Reload" reloads the app with fresh data from the server.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-600" />
        <h2 className="text-lg font-semibold text-gray-900">This screen ran into a problem</h2>
        <p className="mt-2 text-sm text-gray-600">Your data is safe on the server. Try again, or reload to get fresh data.</p>
        <p className="mt-2 break-words font-mono text-xs text-gray-500">{this.state.error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
