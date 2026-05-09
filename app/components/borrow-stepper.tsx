"use client";

type BorrowStepperProps = {
  currentStep: 1 | 2 | 3;
};

const LABELS = [
  { step: 1 as const, title: "Score analysis" },
  { step: 2 as const, title: "Configure loan" },
  { step: 3 as const, title: "Sign & receive" },
];

export function BorrowStepper({ currentStep }: BorrowStepperProps) {
  return (
    <div className="mb-10 w-full overflow-x-auto">
      <div className="relative flex min-w-[min(540px,100%)] justify-between px-2">
        {/* connector line */}
        <div
          className="pointer-events-none absolute left-14 right-14 top-[18px] z-0 hidden h-0.5 bg-border md:block"
          aria-hidden
        >
          <div
            className="h-full bg-primary/35 transition-[width] duration-500"
            style={{
              width:
                currentStep <= 1
                  ? "0%"
                  : currentStep === 2
                    ? "50%"
                    : "100%",
            }}
          />
        </div>
        {LABELS.map((item) => {
          const done = currentStep > item.step;
          const active = currentStep === item.step;
          return (
            <div
              key={item.step}
              className="relative z-10 flex flex-1 flex-col items-center gap-3 px-2 text-center"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition-colors ${
                  done || active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground"
                } ${active ? "ring-[3px] ring-primary/25" : ""}`}
              >
                {item.step}
              </span>
              <p
                className={`max-w-[8.75rem] text-xs leading-snug md:text-[13px] ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {item.title}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
