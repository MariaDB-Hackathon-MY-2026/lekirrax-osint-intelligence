import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#ff4d4d',
          backgroundColor: '#0f1115',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#00e5ff' }}>SENTINEL ERROR</h1>
          <div style={{
            padding: '20px',
            border: '1px solid #333',
            borderRadius: '8px',
            backgroundColor: '#181b21',
            maxWidth: '800px',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            <p style={{ color: '#90a4ae', marginBottom: '10px' }}>The system encountered a critical rendering exception:</p>
            <pre style={{ whiteSpace: 'pre-wrap', color: '#ff4d4d' }}>{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '30px',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#00e5ff',
              border: '1px solid #00e5ff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
