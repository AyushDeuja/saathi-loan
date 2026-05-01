"use client";

import { useEffect, useMemo, useState } from "react";

type RiskScoreGaugeProps = {
  score: number;
  size?: number;
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function getTone(score: number): string {
  if (score < 40) return "#e53935";
  if (score < 60) return "#b7791f";
  return "#4a7c59";
}

export function RiskScoreGauge({ score, size = 180 }: RiskScoreGaugeProps) {
  const safeScore = clampScore(score);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const shouldReduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (shouldReduce) {
      setAnimatedScore(safeScore);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setAnimatedScore(safeScore);
    });

    return () => cancelAnimationFrame(frame);
  }, [safeScore]);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMemo(() => animatedScore / 100, [animatedScore]);
  const dashOffset = circumference * (1 - progress);
  const tone = getTone(safeScore);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Risk score ${safeScore} out of 100`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-border)"
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
            transition: "stroke-dashoffset 900ms cubic-bezier(0, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-4xl font-bold tabular-nums">{safeScore}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Risk Score
        </p>
      </div>
    </div>
  );
}
