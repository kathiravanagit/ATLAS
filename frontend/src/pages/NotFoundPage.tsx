import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#B91C1C]/10 border border-[#B91C1C]/20 mb-6">
          <AlertTriangle size={28} className="text-[#B91C1C]" />
        </div>
        <h1 className="text-4xl font-bold text-[#1F2937] mb-3">404</h1>
        <p className="text-[#6B7280] text-base mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-base text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
