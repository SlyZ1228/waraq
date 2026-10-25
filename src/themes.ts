import type { Theme } from "./types";
export const themes: Record<
  Theme,
  { label: string; paper: string; ink: string; muted: string; accent: string }
> = {
  paper: {
    label: "Paper",
    paper: "#faf9f5",
    ink: "#292e28",
    muted: "#777b70",
    accent: "#526a50",
  },
  sepia: {
    label: "Sepia",
    paper: "#f2e6ce",
    ink: "#493b2a",
    muted: "#857359",
    accent: "#876440",
  },
  sage: {
    label: "Sage",
    paper: "#e5ebe0",
    ink: "#2c4033",
    muted: "#6b7f70",
    accent: "#4d7058",
  },
  dusk: {
    label: "Dusk",
    paper: "#292e32",
    ink: "#e4e2d9",
    muted: "#a7ada9",
    accent: "#b2c6b0",
  },
};
