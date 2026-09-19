import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center">
            <AlertTriangle size={48} className="text-[#ef4444] mx-auto mb-4" />
            <h1 className="text-lg font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-base text-[#d4d4d8] mb-4">
              The application encountered an unexpected error. Please refresh the page or contact support.
            </p>
            <div className="bg-[#18181b] rounded-lg p-3 mb-4 text-left">
              <code className="text-[10px] text-[#ef4444] break-all">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white text-black text-base font-medium rounded-lg hover:bg-[#e4e4e7] transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
