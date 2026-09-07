export type BackAction =
  | "player"
  | "resume-choice"
  | "recommendation"
  | "details"
  | "search"
  | "settings"
  | "error"
  | "arm-exit"
  | "exit";

export interface BackLayers {
  player: boolean;
  resumeChoice: boolean;
  recommendation: boolean;
  details: boolean;
  search: boolean;
  settings: boolean;
  error: boolean;
}

export interface BackDecision {
  action: BackAction;
  exitArmedUntil: number;
}

export const BACK_DEBOUNCE_MS = 450;
export const EXIT_CONFIRMATION_MS = 2_500;

export function shouldIgnoreBackPress(repeat: boolean, now: number, lastHandledAt: number): boolean {
  return repeat || now - lastHandledAt < BACK_DEBOUNCE_MS;
}

export function resolveBackAction(layers: BackLayers, now: number, exitArmedUntil: number): BackDecision {
  if (layers.player) return { action: "player", exitArmedUntil: 0 };
  if (layers.resumeChoice) return { action: "resume-choice", exitArmedUntil: 0 };
  if (layers.recommendation) return { action: "recommendation", exitArmedUntil: 0 };
  if (layers.details) return { action: "details", exitArmedUntil: 0 };
  if (layers.search) return { action: "search", exitArmedUntil: 0 };
  if (layers.settings) return { action: "settings", exitArmedUntil: 0 };
  if (layers.error) return { action: "error", exitArmedUntil: 0 };
  if (exitArmedUntil > 0 && now <= exitArmedUntil) return { action: "exit", exitArmedUntil: 0 };
  return { action: "arm-exit", exitArmedUntil: now + EXIT_CONFIRMATION_MS };
}
