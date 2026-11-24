import AuditLog from '../components/AuditLog';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1C1F]">Audit Trail</h2>
          <p className="text-sm text-[#33373B] mt-1">System activity and investigator actions</p>
        </div>
      </div>
      <AuditLog />
    </div>
  );
}
