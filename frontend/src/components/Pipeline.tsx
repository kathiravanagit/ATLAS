import { FileText, ArrowRight, Cpu, MapPin, Bell, CheckCircle } from 'lucide-react';

interface PipelineProps {
  stage?: number;
}

const steps = [
  { icon: FileText, label: 'Complaint Filed', color: 'text-[#ef4444] bg-[#ef4444]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: Cpu, label: 'Signals Analyzed', color: 'text-[#f59e0b] bg-[#f59e0b]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: Cpu, label: 'Features Extracted', color: 'text-[#e4e4e7] bg-[#27272a]' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: Cpu, label: 'Risk Scored', color: 'text-white bg-[#27272a]' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: MapPin, label: 'Locations Ranked', color: 'text-[#e4e4e7] bg-[#27272a]' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: MapPin, label: 'GIS Visualization', color: 'text-[#22c55e] bg-[#22c55e]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#71717a]' },
  { icon: Bell, label: 'Investigator Alert', color: 'text-[#ef4444] bg-[#ef4444]/10' },
];

export default function Pipeline({ stage = 6 }: PipelineProps) {
  const activeStepIndex = stage * 2;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base text-white">Prediction Pipeline</h3>
        <span className="text-[10px] text-[#d4d4d8] bg-[#27272a] px-2 py-0.5 rounded">
          {stage >= 6 ? 'Complete' : `Stage ${stage + 1}/7`}
        </span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          if (step.label === '') {
            return <ArrowRight key={i} size={10} className="text-[#71717a] shrink-0" />;
          }

          const stepIndex = Math.floor(i / 2);
          const isActive = stepIndex <= stage;
          const isCurrent = stepIndex === stage;

          return (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`p-1.5 rounded-lg transition-colors ${
                isActive ? step.color : 'text-[#71717a] bg-[#18181b]'
              } ${isCurrent ? 'ring-1 ring-white/20' : ''}`}>
                {isActive && stepIndex < stage ? (
                  <CheckCircle size={12} className="text-[#22c55e]" />
                ) : (
                  <step.icon size={12} />
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-[#e4e4e7]' : 'text-[#71717a]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {stage < 6 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#27272a] rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${(stage / 6) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[#d4d4d8]">Processing...</span>
        </div>
      )}
    </div>
  );
}
