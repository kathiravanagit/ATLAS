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
        <div className="min-h-screen bg-[#F6F6F3] flex items-center justify-center p-6">
          <div className="card p-8 max-w-md w-full text-center">
            <AlertTriangle size={48} className="text-[#B91C1C] mx-auto mb-4" />
            <h1 className="text-[15px] font-semibold text-[#1A1C1F] mb-2">Something went wrong</h1>
            <p className="text-sm text-[#5F6368] mb-4">
              The application encountered an unexpected error. Please refresh the page or contact support.
            </p>
            <div className="bg-white rounded-lg p-3 mb-4 text-left border border-[#D2D1CA]">
              <code className="text-[11px] text-[#B91C1C] break-all">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#17406F] text-white text-sm font-medium rounded-lg hover:bg-[#1E40AF] transition-colors"
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
