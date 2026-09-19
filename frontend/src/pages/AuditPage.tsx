import { motion } from 'motion/react';
import AuditLog from '../components/AuditLog';

export default function AuditPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Audit Trail</h2>
          <p className="text-base text-[#e4e4e7] mt-1">System activity and investigator actions</p>
        </div>
      </div>
      <AuditLog />
    </motion.div>
  );
}
