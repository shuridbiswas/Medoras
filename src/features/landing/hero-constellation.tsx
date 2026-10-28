import { cn } from "@/lib/utils";

type NodeSpec = {
  label: string;
  role: string;
  x: number; // percent
  y: number; // percent
  tone: "deep" | "mid" | "light" | "clay";
  delay: string;
};

const nodes: NodeSpec[] = [
  {
    label: "Nursing",
    role: "Student",
    x: 16,
    y: 20,
    tone: "light",
    delay: "0s",
  },
  {
    label: "Social Work",
    role: "Graduate",
    x: 70,
    y: 12,
    tone: "mid",
    delay: "1.2s",
  },
  {
    label: "Pharmacy",
    role: "Professional",
    x: 86,
    y: 48,
    tone: "light",
    delay: "0.6s",
  },
  {
    label: "Psychology",
    role: "Mentor",
    x: 62,
    y: 80,
    tone: "deep",
    delay: "1.8s",
  },
  {
    label: "Physiotherapy",
    role: "Researcher",
    x: 14,
    y: 72,
    tone: "mid",
    delay: "0.3s",
  },
];

const toneClasses: Record<NodeSpec["tone"], string> = {
  deep: "bg-teal-800 text-white border-teal-900",
  mid: "bg-teal-100 text-teal-900 border-teal-200",
  light: "bg-surface text-teal-900 border-border",
  clay: "bg-clay text-white border-clay",
};

const center = { x: 48, y: 46 };

/**
 * Original illustration: people and disciplines orbiting a shared centre.
 * Pure SVG + CSS, decorative only (the heading and copy carry the meaning).
 */
export function HeroConstellation() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-square w-full max-w-[34rem] select-none"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 size-full"
        fill="none"
      >
        <circle
          cx={center.x}
          cy={center.y}
          r="22"
          className="stroke-teal-200"
          strokeDasharray="0.8 1.6"
          strokeWidth="0.35"
        />
        <circle
          cx={center.x}
          cy={center.y}
          r="36"
          className="stroke-teal-200/80"
          strokeWidth="0.3"
        />
        {nodes.map((n) => (
          <line
            key={n.label}
            x1={center.x}
            y1={center.y}
            x2={n.x}
            y2={n.y}
            className="stroke-teal-500/45"
            strokeWidth="0.35"
          />
        ))}
        <line
          x1={nodes[0].x}
          y1={nodes[0].y}
          x2={nodes[1].x}
          y2={nodes[1].y}
          className="stroke-teal-500/20"
          strokeWidth="0.3"
        />
        <line
          x1={nodes[2].x}
          y1={nodes[2].y}
          x2={nodes[3].x}
          y2={nodes[3].y}
          className="stroke-teal-500/20"
          strokeWidth="0.3"
        />
        <line
          x1={nodes[3].x}
          y1={nodes[3].y}
          x2={nodes[4].x}
          y2={nodes[4].y}
          className="stroke-teal-500/20"
          strokeWidth="0.3"
        />
      </svg>

      <div
        className="absolute flex size-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-teal-200 bg-surface shadow-[0_18px_50px_-18px_rgba(14,70,80,0.35)] sm:size-32"
        style={{ left: `${center.x}%`, top: `${center.y}%` }}
      >
        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-teal-800 text-center sm:size-24">
          <span className="font-display text-lg font-semibold leading-none text-white sm:text-xl">
            Belong
          </span>
          <span className="mt-1 h-1 w-6 rounded-full bg-clay" />
        </div>
      </div>

      {nodes.map((n) => (
        <div
          key={n.label}
          className="absolute -translate-x-1/2 -translate-y-1/2 motion-safe:animate-[float-slow_7s_ease-in-out_infinite]"
          style={{ left: `${n.x}%`, top: `${n.y}%`, animationDelay: n.delay }}
        >
          <div
            className={cn(
              "rounded-2xl border px-3.5 py-2.5 shadow-[0_10px_30px_-14px_rgba(14,70,80,0.35)]",
              toneClasses[n.tone],
            )}
          >
            <p className="text-sm font-semibold leading-tight">{n.label}</p>
            <p className="mt-0.5 text-[0.7rem] leading-tight opacity-75">
              {n.role}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
