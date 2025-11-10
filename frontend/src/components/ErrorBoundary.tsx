import React from 'react'

type P = { children: React.ReactNode; fallback?: React.ReactNode }
type S = { hasError: boolean }

export default class ErrorBoundary extends React.Component<P, S> {
  constructor(props: P) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div style={{ padding: 16 }}>Něco se pokazilo.</div>
    }
    return this.props.children
  }
}