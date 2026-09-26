export const tokens = {
  color: {
    text: "#17212b",
    textMuted: "#52616f",
    surface: "#ffffff",
    canvas: "#f4f6f7",
    border: "#d6dde2",
    accent: "#145b66",
    accentStrong: "#0e434b",
    success: "#276749",
    warning: "#8a5600",
    danger: "#a33333",
    focus: "#236dc2",
  },
  spacing: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    6: "1.5rem",
    8: "2rem",
    12: "3rem",
  },
  radius: { small: "0.25rem", medium: "0.5rem", large: "0.75rem" },
  typography: {
    body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, SFMono-Regular, Consolas, monospace",
  },
} as const;

export type DesignTokens = typeof tokens;
