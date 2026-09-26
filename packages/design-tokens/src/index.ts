export const tokens = {
  color: {
    text: "#171717",
    textMuted: "#626262",
    surface: "#ffffff",
    canvas: "#ffffff",
    border: "#e6e6e6",
    accent: "#171717",
    accentStrong: "#171717",
    success: "#171717",
    warning: "#171717",
    danger: "#171717",
    focus: "#202020",
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
