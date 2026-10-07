const SIMULATION_METRICS = [
  { label: 'Alert lead time', value: 'Not measured', detail: 'Requires timestamped alerts and observed cash-out outcomes.' },
  { label: 'Officer review time', value: 'Not measured', detail: 'Requires recorded review durations from a defined evaluation.' },
  { label: 'Alert volume', value: 'Not measured', detail: 'Requires a defined observation period and recorded alert counts.' },
  { label: 'Top-K hit rate', value: 'Unavailable', detail: 'Requires labelled cash-out locations and a reproducible ranking evaluation.' },
];

export default function SyntheticOperationalSimulation() {
  return (
    <section className="rounded-xl border border-[#CBD5E1] bg-white p-5" aria-labelledby="simulation-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="simulation-heading" className="text-sm font-bold uppercase tracking-wide text-[#1D355B]">
            Synthetic operational simulation
          </h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Synthetic workflow demonstration only. No operational benchmark has been measured or verified.
          </p>
        </div>
        <span className="rounded border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#475569]">
          Simulation
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SIMULATION_METRICS.map((metric) => (
          <div key={metric.label} className="border-l-2 border-[#1D4ED8] pl-3">
            <p className="text-[11px] font-semibold text-[#64748B]">{metric.label}</p>
            <p className="mt-1 text-xl font-bold text-[#1D355B]">{metric.value}</p>
            <p className="mt-1 text-[10px] text-[#64748B]">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
