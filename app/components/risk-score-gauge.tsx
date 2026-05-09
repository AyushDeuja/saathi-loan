"use client";

type RiskScoreGaugeProps = {
  score: number;
  size?: number;
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

export function RiskScoreGauge({ score, size = 200 }: RiskScoreGaugeProps) {
  const safeScore = clampScore(score);

  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = safeScore / 100;
  const dashOffset = circumference * (1 - progress);
  const tone = "var(--color-primary)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Trust score ${safeScore} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-border/90"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition:
              "stroke-dashoffset 900ms cubic-bezier(0, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="absolute px-6 text-center">
        <p className="font-mono text-[2.65rem] font-bold leading-none tabular-nums text-foreground">
          {safeScore}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trust Score
        </p>
      </div>
    </div>
  );
}
