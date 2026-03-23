import { type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const defaults = (size = 24): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* ── Content type icons ── */

export function IconMoon({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}

export function IconMusicNote({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M9 18V5l12-3v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="15" r="3" />
    </svg>
  );
}

export function IconLightbulb({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M9 21h6M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function IconChat({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconHand({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.5 0-4.5-1-6.2-2.8L4 17" />
    </svg>
  );
}

export function IconHearts({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A5.99 5.99 0 0 0 7.5 3C4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z" />
    </svg>
  );
}

/* ── Duration icons ── */

export function IconClockShort({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v3l2 1" />
    </svg>
  );
}

export function IconClockMedium({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconClockLong({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 3" />
    </svg>
  );
}

/* ── Mood icons ── */

export function IconSun({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconWave({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity=".5" />
    </svg>
  );
}

/* ── Voice icon ── */

export function IconMic({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18.5V22M8 22h8" />
    </svg>
  );
}

/* ── Player icons ── */

export function IconPlay({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <polygon points="6,3 20,12 6,21" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Utility icons ── */

export function IconBook({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function IconHistory({ size, ...props }: IconProps) {
  return (
    <svg {...defaults(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}
