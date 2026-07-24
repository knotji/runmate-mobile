import { Component, type ErrorInfo, type ReactNode } from 'react';
import { recordRuntimeError } from '@/lib/runtimeDiagnostics';
import { reportCrash } from '@/lib/crashReporting';
import './AppErrorBoundary.css';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordRuntimeError(error);
    void reportCrash(error, `Page render failed at ${window.location.pathname}`);
    console.error('[runtime] page render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="app-crash-shell" role="alert">
      <div className="app-crash-mark" aria-hidden="true">!</div>
      <p>RunMate</p>
      <h1>This Screen Could Not Load</h1>
      <span>Your saved data is unchanged. Reload the app to try this screen again.</span>
      <button type="button" onClick={() => window.location.reload()}>Reload RunMate</button>
      <button type="button" className="secondary" onClick={() => window.location.assign('/tabs/recovery')}>Return To Recovery</button>
    </main>;
  }
}
