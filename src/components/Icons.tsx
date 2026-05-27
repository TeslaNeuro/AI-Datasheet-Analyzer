import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base: Props = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconUpload = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

export const IconFile = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

export const IconChip = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <path d="M9 2v2M12 2v2M15 2v2M9 20v2M12 20v2M15 20v2M2 9h2M2 12h2M2 15h2M20 9h2M20 12h2M20 15h2" />
  </svg>
);

export const IconBolt = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
);

export const IconShield = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
  </svg>
);

export const IconWarn = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconGauge = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 14 8 9" />
    <path d="M3.69 17A9 9 0 1 1 21 12.07" />
  </svg>
);

export const IconPin = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 17v5" />
    <path d="M9 11V5a3 3 0 0 1 6 0v6l3 3v2H6v-2z" />
  </svg>
);

export const IconCircuit = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M11 9h4v6h-4z" />
    <path d="M11 12H4M20 12h-5M13 9V4M13 20v-5" />
    <circle cx="4" cy="12" r="1.25" />
    <circle cx="20" cy="12" r="1.25" />
    <circle cx="13" cy="4" r="1.25" />
    <circle cx="13" cy="20" r="1.25" />
  </svg>
);

export const IconSwap = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M7 16V4M3 8l4-4 4 4" />
    <path d="M17 8v12M21 16l-4 4-4-4" />
  </svg>
);

export const IconCheck = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export const IconCopy = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const IconDownload = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const IconSettings = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const IconX = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const IconSpinner = (p: Props) => (
  <svg {...base} {...p} className={"animate-spin " + (p.className ?? "")}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
);

export const IconList = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
