// Brand tokens copied from docs/design/tokens.css (light theme). Keep in sync by hand: the values are few and stable.
// Rule from PRD 15.6: ink, accent and Satoshi in animations. accent-2 is decorative only (borders, bars), never text.
export const c = {
  canvas: "#ffffff",
  surface: "#f9f9f9",
  fg: "#282943",
  fgStrong: "#131313",
  fgMuted: "#5f606c",
  border: "#e4e4e4",
  controlBorder: "#8e8e8f",
  accent: "#424bd1",
  accentSoft: "#ecedfa",
  accentSubtle: "#f5f6fd",
  accent2: "#ec612a",
  success: "#16703a",
  successSoft: "#e8f5ec",
  warning: "#8a5410",
  warningSoft: "#fff4e5",
  danger: "#a93d17",
  dangerSoft: "#fdece7",
  codeBg: "#0f1729",
  codeHeaderBg: "#16203a",
  codeFg: "#e6edf3",
  codeMuted: "#9aa4b2",
} as const;

export const font = {
  sans: '"Satoshi", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
} as const;

/** Layout (1280x720). Top 150px is the headline; the bottom 110px stays clear for the native caption track. */
export const layout = { sideX: 60, headlineH: 150, contentTop: 170, contentBottom: 610 } as const;
