import { motion } from 'motion/react';
import { useDashboard } from '../context/DashboardContext';
import AlertPanel from '../components/AlertPanel';
import ReviewQueue from '../components/ReviewQueue';

export default function AlertsPage() {
  const { alerts, handleAcknowledge } = useDashboard();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1F2937]">Investigation Alerts</h2>
        <p className="text-base text-[#374151] mt-1">High-risk prediction notifications for investigation team</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
        <ReviewQueue />
      </div>
    </motion.div>
  );
}
