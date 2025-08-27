import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('Runtime error:', error, info); }
  render() {
    if (this.state.hasError) return <div style={{ padding: 24, color: 'crimson' }}>Došlo k chybě: {String(this.state.error)}</div>;
    return this.props.children;
  }
}
