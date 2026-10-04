const SIMULATION_METRICS = [
  { label: 'Alert lead time', value: '42 min', detail: 'before synthetic cash-out window' },
  { label: 'Officer review time', value: '8 min', detail: 'median simulated queue review' },
  { label: 'Alert volume', value: '18 / day', detail: 'synthetic alerts requiring triage' },
  { label: 'Top-K hit rate', value: '72%', detail: 'top-3 on the synthetic benchmark' },
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
            Reproducible fixture run for workflow demonstration only; not real-data validation.
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
