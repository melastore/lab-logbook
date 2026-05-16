import type { CSSProperties } from "react";

type UserAvatarProps = {
  fullName?: string;
  username?: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
};

const palettes = [
  ["#006a60", "#9ff2e5", "#00201c"],
  ["#456179", "#cce5ff", "#071d2a"],
  ["#6d45b6", "#ecdfff", "#21005d"],
  ["#845400", "#ffddb0", "#2a1800"],
  ["#006d43", "#b8f1ce", "#002111"],
  ["#00658b", "#c5e7ff", "#001e2d"],
  ["#5b4a0f", "#f5e6b0", "#1a1200"],
  ["#6b1f6d", "#f3c6f5", "#200024"],
  ["#1a5276", "#aed6f1", "#071d2a"],
  ["#1e6b3c", "#a9dfbf", "#0b3d1f"],
];

type ChemSym = "atom" | "hex" | "flask" | "molecule" | "dna" | "ring";

const symbols: ChemSym[] = ["atom", "hex", "flask", "molecule", "dna", "ring"];

function ChemDecoration({ sym }: { sym: ChemSym }) {
  const base = { className: "avatar-deco", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (sym === "atom") return (
    <svg {...base} strokeWidth="0.9">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="10" ry="3.8" />
      <ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="3.8" transform="rotate(-60 12 12)" />
    </svg>
  );

  if (sym === "hex") return (
    <svg {...base} strokeWidth="0.9">
      <polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7" />
      <polygon points="12,6.5 17,9.25 17,14.75 12,17.5 7,14.75 7,9.25" />
      <line x1="12" y1="2"   x2="12" y2="6.5" />
      <line x1="20.7" y1="7" x2="17" y2="9.25" />
      <line x1="20.7" y1="17" x2="17" y2="14.75" />
      <line x1="12" y1="22"  x2="12" y2="17.5" />
      <line x1="3.3" y1="17" x2="7" y2="14.75" />
      <line x1="3.3" y1="7"  x2="7" y2="9.25" />
    </svg>
  );

  if (sym === "flask") return (
    <svg {...base} strokeWidth="0.9">
      <path d="M9 3h6m-3 0v6l4.5 9a2 2 0 01-1.8 3H9.3a2 2 0 01-1.8-3L12 9V3" />
      <path d="M6.5 17h11" />
      <circle cx="10" cy="19" r=".6" fill="currentColor" />
      <circle cx="14" cy="20.5" r=".5" fill="currentColor" />
    </svg>
  );

  if (sym === "molecule") return (
    <svg {...base} strokeWidth="0.8">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <circle cx="4"  cy="7"  r="1.6" fill="currentColor" />
      <circle cx="20" cy="7"  r="1.6" fill="currentColor" />
      <circle cx="4"  cy="17" r="1.6" fill="currentColor" />
      <circle cx="20" cy="17" r="1.6" fill="currentColor" />
      <circle cx="12" cy="3"  r="1.3" fill="currentColor" />
      <line x1="12" y1="9.8" x2="4"  y2="7" />
      <line x1="12" y1="9.8" x2="20" y2="7" />
      <line x1="12" y1="14.2" x2="4"  y2="17" />
      <line x1="12" y1="14.2" x2="20" y2="17" />
      <line x1="12" y1="9.8" x2="12" y2="4.3" />
    </svg>
  );

  if (sym === "dna") return (
    <svg {...base} strokeWidth="0.9">
      <path d="M8 3c0 0 2 3 2 9s-2 9-2 9" />
      <path d="M16 3c0 0-2 3-2 9s2 9 2 9" />
      <line x1="8.4"  y1="6"   x2="15.6" y2="6" />
      <line x1="8.1"  y1="9.5" x2="15.9" y2="9.5" />
      <line x1="8.1"  y1="14.5" x2="15.9" y2="14.5" />
      <line x1="8.4"  y1="18"  x2="15.6" y2="18" />
    </svg>
  );

  // ring (cyclohexane chair-like)
  return (
    <svg {...base} strokeWidth="0.9">
      <polygon points="12,2 21,7.5 21,16.5 12,22 3,16.5 3,7.5" />
      <circle cx="12" cy="2"    r="1.1" fill="currentColor" />
      <circle cx="21" cy="7.5"  r="1.1" fill="currentColor" />
      <circle cx="21" cy="16.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="22"   r="1.1" fill="currentColor" />
      <circle cx="3"  cy="16.5" r="1.1" fill="currentColor" />
      <circle cx="3"  cy="7.5"  r="1.1" fill="currentColor" />
    </svg>
  );
}

export function UserAvatar({ fullName = "", username = "", seed = "", size = "md" }: UserAvatarProps) {
  const displayName = fullName || username || "User";
  const initials = initialsFor(displayName);
  const hash = hashString(seed || displayName);
  const palette = palettes[hash % palettes.length];
  const sym = symbols[hash % symbols.length];

  const style = {
    "--avatar-bg": `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`,
    "--avatar-fg": palette[2],
  } as CSSProperties;

  return (
    <span className={`avatar avatar-${size}`} style={style} aria-hidden="true" title={displayName}>
      <ChemDecoration sym={sym} />
      <span style={{ position: "relative", zIndex: 1, fontWeight: 900 }}>{initials}</span>
    </span>
  );
}

function initialsFor(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "U").toUpperCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
