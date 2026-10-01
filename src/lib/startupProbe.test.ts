import { describe, expect, it } from "vitest";
import {
  FAILOVER_STARTUP_BUDGET_MS,
  FIRST_ATTEMPT_SILENT_STARTUP_TIMEOUT_MS,
  getBufferedEndSeconds,
  getSilentStartupLimitMs,
  getStartupAttemptLimitMs,
  hasMeaningfulStartupProgress,
  isStartupProbeSettled,
  PROGRESSING_STARTUP_TIMEOUT_MS,
  resolveStartupDeadline,
  SILENT_STARTUP_TIMEOUT_MS
} from "./startupProbe";

describe("TV startup probe", () => {
  it("gives a silent source seven seconds", () => {
    expect(getStartupAttemptLimitMs(false, 55_000)).toBe(SILENT_STARTUP_TIMEOUT_MS);
  });

  it("extends a responding source to twenty seconds", () => {
    expect(getStartupAttemptLimitMs(true, 55_000)).toBe(PROGRESSING_STARTUP_TIMEOUT_MS);
  });

  it("never exceeds the remaining all-source startup budget", () => {
    expect(getStartupAttemptLimitMs(true, 9_500)).toBe(9_500);
    expect(getStartupAttemptLimitMs(false, 4_000)).toBe(4_000);
  });

  it("accepts either a progress event or meaningful buffered growth", () => {
    expect(hasMeaningfulStartupProgress(true, 0, 0)).toBe(true);
    expect(hasMeaningfulStartupProgress(false, 0, 0.2)).toBe(true);
    expect(hasMeaningfulStartupProgress(false, 1, 1.01)).toBe(false);
  });

  it("reads the furthest buffered range defensively", () => {
    expect(getBufferedEndSeconds({
      length: 3,
      end: index => [2, 7.5, 5][index]
    })).toBe(7.5);
    expect(getBufferedEndSeconds(undefined)).toBe(0);
  });

  it("gives the first attempt of a playback session fifteen silent seconds", () => {
    expect(getSilentStartupLimitMs(true)).toBe(FIRST_ATTEMPT_SILENT_STARTUP_TIMEOUT_MS);
    expect(getStartupAttemptLimitMs(false, 55_000, true)).toBe(15_000);
    expect(getStartupAttemptLimitMs(false, 55_000, false)).toBe(SILENT_STARTUP_TIMEOUT_MS);
  });

  it("still extends a responding first attempt to twenty seconds", () => {
    expect(getStartupAttemptLimitMs(true, 55_000, true)).toBe(PROGRESSING_STARTUP_TIMEOUT_MS);
  });

  it("keeps the first-attempt window inside the remaining budget", () => {
    expect(getStartupAttemptLimitMs(false, 9_000, true)).toBe(9_000);
  });
});

describe("TV startup deadline", () => {
  const now = 1_000_000;

  it("keeps an active startup budget unchanged", () => {
    expect(resolveStartupDeadline(now + 12_000, now, true)).toBe(now + 12_000);
    expect(resolveStartupDeadline(now + 12_000, now, false)).toBe(now + 12_000);
  });

  it("starts a fresh budget when playback already started and the stream changes", () => {
    expect(resolveStartupDeadline(0, now, true)).toBe(now + FAILOVER_STARTUP_BUDGET_MS);
  });

  it("does not restart the budget when the same playing stream is re-checked", () => {
    expect(resolveStartupDeadline(0, now, false)).toBe(0);
  });

  it("treats a failover source as unsettled until it actually plays", () => {
    const failoverDeadline = resolveStartupDeadline(0, now, true);
    expect(isStartupProbeSettled(failoverDeadline, { paused: true, readyState: 0 })).toBe(false);
    expect(isStartupProbeSettled(failoverDeadline, { paused: true, readyState: 4 })).toBe(false);
    expect(isStartupProbeSettled(failoverDeadline, { paused: false, readyState: 4 })).toBe(true);
  });

  it("is settled once playback cleared the deadline", () => {
    expect(isStartupProbeSettled(0, { paused: true, readyState: 0 })).toBe(true);
    expect(isStartupProbeSettled(0, null)).toBe(true);
  });
});

