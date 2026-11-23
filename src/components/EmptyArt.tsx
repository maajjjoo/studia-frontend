import type { JSX } from "react";
// Small decorative illustrations for empty states. Purely visual: colors come from
// the theme tokens in CSS (.ea-*), so they follow the active palette and dark mode.

export type EmptyArtKind = "tasks" | "calendar" | "focus" | "planner" | "free";

const Sparkle = ({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) => (
  <g className="ea-sparkle" style={{ animationDelay: `${d}ms` }} transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z" />
  </g>
);

function Tasks() {
  return (
    <>
      <g className="ea-float">
        <rect className="ea-paper" x="48" y="22" width="64" height="80" rx="12" />
        <rect className="ea-deep" x="66" y="16" width="28" height="12" rx="6" />
        {[44, 62, 80].map((y, i) => (
          <g key={y}>
            <rect className="ea-check-box" x="60" y={y - 6} width="12" height="12" rx="4" />
            <path className="ea-check" style={{ animationDelay: `${300 + i * 220}ms` }} d={`M62.5 ${y} l2.6 2.6 l4.6 -5`} />
            <rect className="ea-line" x="78" y={y - 3} width={i === 1 ? 18 : 24} height="6" rx="3" />
          </g>
        ))}
      </g>
      <Sparkle x={124} y={30} d={0} />
      <Sparkle x={36} y={86} s={0.7} d={900} />
    </>
  );
}

function Calendar() {
  return (
    <>
      <g className="ea-float">
        <rect className="ea-paper" x="38" y="26" width="84" height="74" rx="12" />
        <path className="ea-deep" d="M38 38 a12 12 0 0 1 12 -12 h60 a12 12 0 0 1 12 12 v8 h-84 z" />
        <rect className="ea-ring" x="56" y="18" width="6" height="16" rx="3" />
        <rect className="ea-ring" x="98" y="18" width="6" height="16" rx="3" />
        {[0, 1, 2].map(r => [0, 1, 2, 3].map(c => {
          const hot = r === 1 && c === 2;
          return <rect key={`${r}${c}`} className={hot ? "ea-accent ea-pulse" : "ea-cell"} x={50 + c * 16} y={54 + r * 14} width="10" height="9" rx="3" />;
        }))}
      </g>
      <Sparkle x={130} y={36} d={200} />
      <Sparkle x={30} y={60} s={0.65} d={1100} />
    </>
  );
}

function Focus() {
  return (
    <>
      <g className="ea-float">
        <circle className="ea-paper" cx="80" cy="64" r="38" />
        <circle className="ea-track" cx="80" cy="64" r="29" />
        <circle className="ea-arc" cx="80" cy="64" r="29" pathLength="100" />
        <rect className="ea-deep" x="74" y="20" width="12" height="7" rx="3" />
        <path className="ea-hand" d="M80 64 V46" />
        <circle className="ea-deep" cx="80" cy="64" r="3.5" />
      </g>
      <Sparkle x={128} y={34} d={400} />
      <Sparkle x={34} y={92} s={0.7} d={1300} />
    </>
  );
}

function Planner() {
  return (
    <>
      <g className="ea-float">
        <rect className="ea-paper" x="34" y="30" width="92" height="66" rx="12" />
        {[0, 1, 2, 3, 4].map(c => (
          <rect key={c} className="ea-cell" x={44 + c * 16} y="40" width="10" height="46" rx="4" />
        ))}
        <rect className="ea-accent ea-block" style={{ animationDelay: "200ms" }} x="44" y="46" width="10" height="16" rx="4" />
        <rect className="ea-deep ea-block" style={{ animationDelay: "380ms" }} x="76" y="58" width="10" height="20" rx="4" />
        <rect className="ea-accent ea-block" style={{ animationDelay: "560ms" }} x="108" y="44" width="10" height="12" rx="4" />
      </g>
      <g className="ea-float-alt">
        <circle className="ea-paper" cx="122" cy="94" r="15" />
        <path className="ea-hand" d="M122 94 V86 M122 94 l6 3" />
      </g>
      <Sparkle x={36} y={24} s={0.75} d={700} />
    </>
  );
}

function Free() {
  return (
    <>
      <g className="ea-float">
        <path className="ea-steam" d="M70 44 c-5 -6 5 -10 0 -16" />
        <path className="ea-steam" style={{ animationDelay: "600ms" }} d="M84 44 c-5 -6 5 -10 0 -16" />
        <path className="ea-paper" d="M56 52 h44 v18 a22 22 0 0 1 -44 0 z" />
        <path className="ea-handle" d="M100 58 h5 a8 8 0 0 1 0 16 h-6" />
        <rect className="ea-accent" x="56" y="52" width="44" height="7" rx="3" />
      </g>
      <ellipse className="ea-shadow" cx="78" cy="100" rx="26" ry="4" />
    </>
  );
}

const ART: Record<EmptyArtKind, () => JSX.Element> = { tasks: Tasks, calendar: Calendar, focus: Focus, planner: Planner, free: Free };

export function EmptyArt({ kind, size = "md" }: { kind: EmptyArtKind; size?: "sm" | "md" }) {
  const Art = ART[kind];
  return (
    <svg className={`empty-art empty-art-${size}`} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
      <circle className="ea-bg" cx="80" cy="64" r="52" />
      <Art />
    </svg>
  );
}
