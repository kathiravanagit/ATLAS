import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#dc2626]/10 border border-[#dc2626]/20 mb-6">
          <AlertTriangle size={28} className="text-[#dc2626]" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">404</h1>
        <p className="text-[#d4d4d8] text-base mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#18181b] border border-white/[0.08] rounded-xl text-base text-white hover:bg-[#27272a] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
