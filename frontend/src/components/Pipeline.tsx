import { FileText, ArrowRight, Cpu, MapPin, Bell, CheckCircle } from 'lucide-react';

interface PipelineProps {
  stage?: number;
}

const steps = [
  { icon: FileText, label: 'Complaint Filed', color: 'text-[#B91C1C] bg-[#B91C1C]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: Cpu, label: 'Signals Analyzed', color: 'text-[#B45309] bg-[#B45309]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: Cpu, label: 'Features Extracted', color: 'text-[#43474C] bg-[#EFEFEA]' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: Cpu, label: 'Risk Scored', color: 'text-[#1A1C1F] bg-[#EFEFEA]' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: MapPin, label: 'Locations Ranked', color: 'text-[#43474C] bg-[#EFEFEA]' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: MapPin, label: 'GIS Visualization', color: 'text-[#15803D] bg-[#15803D]/10' },
  { icon: ArrowRight, label: '', color: 'text-[#5F6368]' },
  { icon: Bell, label: 'Investigator Alert', color: 'text-[#B91C1C] bg-[#B91C1C]/10' },
];

export default function Pipeline({ stage = 6 }: PipelineProps) {
  const activeStepIndex = stage * 2;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-[#1A1C1F]">Prediction pipeline</h3>
        <span className="text-[10px] text-[#5F6368] bg-[#EFEFEA] px-2 py-0.5 rounded">
          {stage >= 6 ? 'Complete' : `Stage ${stage + 1}/7`}
        </span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, i) => {
          if (step.label === '') {
            return <ArrowRight key={i} size={10} className="text-[#5F6368] shrink-0" />;
          }

          const stepIndex = Math.floor(i / 2);
          const isActive = stepIndex <= stage;
          const isCurrent = stepIndex === stage;

          return (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`p-1.5 rounded-lg transition-colors ${
                isActive ? step.color : 'text-[#5F6368] bg-[#EFEFEA]'
              } ${isCurrent ? 'ring-1 ring-[#12355B]/20' : ''}`}>
                {isActive && stepIndex < stage ? (
                  <CheckCircle size={12} className="text-[#15803D]" />
                ) : (
                  <step.icon size={12} />
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-[#43474C]' : 'text-[#5F6368]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      {stage < 6 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-[#E2E1DB] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#17406F] rounded-full transition-colors duration-500"
              style={{ width: `${(stage / 6) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[#5F6368]">Processing...</span>
        </div>
      )}
    </div>
  );
}
