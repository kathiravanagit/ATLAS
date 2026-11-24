import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F3] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#B91C1C]/10 border border-[#B91C1C]/20 mb-6">
          <AlertTriangle size={28} className="text-[#B91C1C]" />
        </div>
        <h1 className="text-4xl font-semibold text-[#1A1C1F] mb-3">404</h1>
        <p className="text-[#5F6368] text-sm mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#D2D1CA] rounded-xl text-sm text-[#1A1C1F] hover:bg-[#EFEFEA] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
