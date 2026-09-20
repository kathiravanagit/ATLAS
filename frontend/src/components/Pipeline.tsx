import { FileText, ArrowRight, Cpu, MapPin, Bell, CheckCircle } from 'lucide-react';

interface PipelineProps {
  stage?: number;
}

const steps = [
  { icon: FileText, label: 'Complaint Filed', color: 'text-[#B91C1C] bg-[#B91C1C]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: Cpu, label: 'Signals Analyzed', color: 'text-[#B45309] bg-[#B45309]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: Cpu, label: 'Features Extracted', color: 'text-[#4B5563] bg-[#F3F4F6]' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: Cpu, label: 'Risk Scored', color: 'text-[#1F2937] bg-[#F3F4F6]' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: MapPin, label: 'Locations Ranked', color: 'text-[#4B5563] bg-[#F3F4F6]' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: MapPin, label: 'GIS Visualization', color: 'text-[#15803D] bg-[#15803D]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#6B7280]' },
  { icon: Bell, label: 'Investigator Alert', color: 'text-[#B91C1C] bg-[#B91C1C]/10' },
];

export default function Pipeline({ stage = 6 }: PipelineProps) {
  const activeStepIndex = stage * 2;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base text-[#1F2937]">Prediction Pipeline</h3>
        <span className="text-[10px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded">
          {stage >= 6 ? 'Complete' : `Stage ${stage + 1}/7`}
        </span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          if (step.label === '') {
            return <ArrowRight key={i} size={10} className="text-[#6B7280] shrink-0" />;
          }

          const stepIndex = Math.floor(i / 2);
          const isActive = stepIndex <= stage;
          const isCurrent = stepIndex === stage;

          return (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`p-1.5 rounded-lg transition-colors ${
                isActive ? step.color : 'text-[#6B7280] bg-[#F3F4F6]'
              } ${isCurrent ? 'ring-1 ring-[#1D355B]/20' : ''}`}>
                {isActive && stepIndex < stage ? (
                  <CheckCircle size={12} className="text-[#15803D]" />
                ) : (
                  <step.icon size={12} />
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-[#4B5563]' : 'text-[#6B7280]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {stage < 6 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1D4ED8] rounded-full transition-all duration-500"
              style={{ width: `${(stage / 6) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[#6B7280]">Processing...</span>
        </div>
      )}
    </div>
  );
}
