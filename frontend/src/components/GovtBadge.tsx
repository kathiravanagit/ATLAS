import icon from '../assets/icon.png';

interface GovtBadgeProps {
  size?: number;
  className?: string;
}

export default function GovtBadge({ size = 24, className = "" }: GovtBadgeProps) {
  return (
    <img
      src={icon}
      alt="ATLAS Prototype Logo"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
