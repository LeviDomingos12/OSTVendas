export interface SystemTheme {
  id: string;
  name: string;
  primary: string;       // hex, e.g. "#f97316"
  hover: string;         // hex, e.g. "#ea580c"
  accentBg: string;      // hex/rgba, e.g. "#fff7ed"
  text: string;          // hex, e.g. "#ea580c"
  rgb: string;           // "r, g, b" for opacity-based styles
}

export const SYSTEM_THEMES: SystemTheme[] = [
  {
    id: "laranja",
    name: "Laranja Clássico",
    primary: "#f97316",
    hover: "#ea580c",
    accentBg: "#fff7ed",
    text: "#ea580c",
    rgb: "249, 115, 22"
  },
  {
    id: "azul",
    name: "Azul Oceano",
    primary: "#0ea5e9",
    hover: "#0284c7",
    accentBg: "#f0f9ff",
    text: "#0284c7",
    rgb: "14, 165, 233"
  },
  {
    id: "verde",
    name: "Verde Esmeralda",
    primary: "#10b981",
    hover: "#059669",
    accentBg: "#ecfdf5",
    text: "#059669",
    rgb: "16, 185, 129"
  },
  {
    id: "roxo",
    name: "Roxo Real",
    primary: "#8b5cf6",
    hover: "#7c3aed",
    accentBg: "#f5f3ff",
    text: "#7c3aed",
    rgb: "139, 92, 246"
  },
  {
    id: "rosa",
    name: "Rosa Carmim",
    primary: "#ec4899",
    hover: "#db2777",
    accentBg: "#fdf2f8",
    text: "#db2777",
    rgb: "236, 72, 153"
  },
  {
    id: "turquesa",
    name: "Turquesa Tropical",
    primary: "#14b8a6",
    hover: "#0d9488",
    accentBg: "#f0fdfa",
    text: "#0d9488",
    rgb: "20, 184, 166"
  },
  {
    id: "vermelho",
    name: "Vermelho Rubi",
    primary: "#ef4444",
    hover: "#dc2626",
    accentBg: "#fef2f2",
    text: "#dc2626",
    rgb: "239, 68, 68"
  },
  {
    id: "indigo",
    name: "Indigo Profundo",
    primary: "#6366f1",
    hover: "#4f46e5",
    accentBg: "#eef2ff",
    text: "#4f46e5",
    rgb: "99, 102, 241"
  },
  {
    id: "ambar",
    name: "Âmbar Dourado",
    primary: "#f59e0b",
    hover: "#d97706",
    accentBg: "#fffbeb",
    text: "#d97706",
    rgb: "245, 158, 11"
  },
  {
    id: "slate",
    name: "Cinza Moderno (Slate)",
    primary: "#64748b",
    hover: "#475569",
    accentBg: "#f8fafc",
    text: "#475569",
    rgb: "100, 116, 139"
  }
];

export function applyTheme(themeId: string) {
  const theme = SYSTEM_THEMES.find(t => t.id === themeId) || SYSTEM_THEMES[0];
  
  let styleEl = document.getElementById("system-theme-overrides") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "system-theme-overrides";
    document.head.appendChild(styleEl);
  }

  styleEl.innerHTML = `
    :root {
      --theme-primary: ${theme.primary};
      --theme-hover: ${theme.hover};
      --theme-accent-bg: ${theme.accentBg};
      --theme-text: ${theme.text};
      --theme-rgb: ${theme.rgb};
    }

    /* Vibrant background styling for body in light mode */
    body:not(.dark) {
      background-color: #fbfbfd !important;
      background-image: 
        radial-gradient(at 0% 0%, rgba(${theme.rgb}, 0.04) 0px, transparent 50%),
        radial-gradient(at 50% 0%, rgba(245, 158, 11, 0.03) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(${theme.rgb}, 0.02) 0px, transparent 50%) !important;
      background-attachment: fixed;
    }

    /* Beautiful white cards styling in light mode */
    body:not(.dark) .bg-white {
      background-color: #ffffff !important;
      border-color: #f1f3f7 !important;
      box-shadow: 0 10px 30px -10px rgba(${theme.rgb}, 0.05), 0 1px 3px rgba(0, 0, 0, 0.01) !important;
      border-radius: 1.25rem;
    }

    /* Beautiful colorful borders on tables in light mode */
    body:not(.dark) td {
      border-bottom-color: #f8fafc !important;
    }

    /* Vibrant colorful gradients for main buttons */
    .bg-orange-500 {
      background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-hover) 100%) !important;
      box-shadow: 0 4px 18px -4px rgba(${theme.rgb}, 0.35) !important;
      border: none !important;
      transition: all 0.2s ease-in-out !important;
    }
    .bg-orange-500:hover {
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 22px -2px rgba(${theme.rgb}, 0.45) !important;
    }

    /* Input focus styled beautifully */
    input:focus, select:focus, textarea:focus {
      border-color: var(--theme-primary) !important;
      box-shadow: 0 0 0 3px rgba(${theme.rgb}, 0.15) !important;
    }

    /* Override all orange bg utilities */
    .bg-orange-650 {
      background-color: var(--theme-hover) !important;
    }
    .hover\\:bg-orange-600:hover {
      background-color: var(--theme-hover) !important;
    }
    .bg-orange-600 {
      background-color: var(--theme-hover) !important;
    }
    .bg-orange-50 {
      background-color: rgba(${theme.rgb}, 0.05) !important;
      color: var(--theme-hover) !important;
      border: 1px solid rgba(${theme.rgb}, 0.12) !important;
    }
    .bg-orange-100 {
      background-color: rgba(${theme.rgb}, 0.08) !important;
      color: var(--theme-hover) !important;
      border: 1px solid rgba(${theme.rgb}, 0.15) !important;
    }

    /* Override text colors */
    .text-orange-500 {
      color: var(--theme-primary) !important;
    }
    .text-orange-600 {
      color: var(--theme-hover) !important;
    }
    .text-orange-700 {
      color: var(--theme-hover) !important;
    }
    .hover\\:text-orange-600:hover {
      color: var(--theme-hover) !important;
    }

    /* Override border colors */
    .border-orange-500 {
      border-color: var(--theme-primary) !important;
    }
    .border-orange-600 {
      border-color: var(--theme-hover) !important;
    }
    .border-orange-250 {
      border-color: rgba(${theme.rgb}, 0.25) !important;
    }
    .border-orange-200 {
      border-color: rgba(${theme.rgb}, 0.2) !important;
    }
    .border-orange-150 {
      border-color: rgba(${theme.rgb}, 0.15) !important;
    }
    .border-orange-100 {
      border-color: rgba(${theme.rgb}, 0.1) !important;
    }

    /* Override focus classes */
    .focus\\:ring-orange-500:focus {
      --tw-ring-color: var(--theme-primary) !important;
      border-color: var(--theme-primary) !important;
    }
    .focus\\:border-orange-500:focus {
      border-color: var(--theme-primary) !important;
    }

    /* Override custom elements */
    .shadow-orange-500\\/15 {
      --tw-shadow-color: rgba(${theme.rgb}, 0.15) !important;
    }
    .shadow-orange-500\\/25 {
      --tw-shadow-color: rgba(${theme.rgb}, 0.25) !important;
    }
    .shadow-lg {
      --tw-shadow-color: rgba(${theme.rgb}, 0.08) !important;
    }
  `;
}
