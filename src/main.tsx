import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

console.log('[DEBUG] main.tsx executing');

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: '' }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  componentDidCatch(error: Error) { alert('React crash: ' + error.message); }
  render() { if (this.state.hasError) return <div style={{padding:20,color:'red'}}>CRASH: {this.state.error}</div>; return this.props.children; }
}

// Register PWA service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered:', reg.scope))
    .catch(err => console.log('SW registration failed:', err));
}

const rootEl = document.getElementById('root');
console.log('[DEBUG] root element:', rootEl ? 'found' : 'missing');
createRoot(rootEl!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)