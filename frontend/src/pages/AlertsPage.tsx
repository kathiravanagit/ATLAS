import { useDashboard } from '../context/DashboardContext';
import AlertPanel from '../components/AlertPanel';
import ReviewQueue from '../components/ReviewQueue';

export default function AlertsPage() {
  const { alerts, handleAcknowledge } = useDashboard();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A1C1F]">Investigation alerts</h2>
        <p className="mt-1 text-sm text-[#43474C]">High-risk alerts raised from ranked locations, newest first</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
        <ReviewQueue />
      </div>
    </div>
  );
}
