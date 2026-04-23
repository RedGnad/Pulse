import type { CSSProperties } from "react";

interface Props {
  size?: number;
  color?: string;
  animated?: boolean;
  style?: CSSProperties;
}

export function PulseLogo({ size = 24, color = "#00FF88", animated = false, style }: Props) {
  const id = `pulse-glow-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden
    >
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M3 16 H10 L12.5 10 L16 22 L19.5 13 L22 16 H29"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id})`}
      >
        {animated && (
          <animate
            attributeName="stroke-dasharray"
            values="0 60;60 0;0 60"
            dur="2.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  );
}
