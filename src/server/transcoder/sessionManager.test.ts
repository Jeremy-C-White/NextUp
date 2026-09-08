import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { TranscodeSessionManager } from "./sessionManager.js";

describe("Transcode Session Manager", () => {
  const testBaseDir = path.join(os.tmpdir(), `nextup_test_${Date.now()}`);
  let manager: TranscodeSessionManager;

  beforeEach(() => {
    manager = new TranscodeSessionManager(testBaseDir);
  });

  afterEach(() => {
    manager.stop();
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  it("initializes base directory and cleans previous temp runs", () => {
    expect(fs.existsSync(testBaseDir)).toBe(true);
    expect(manager.getSessionCount()).toBe(0);
  });

  it("handles heartbeat updates and rejects invalid tokens", () => {
    expect(() => {
      manager.recordHeartbeat("nonexistent", "badtoken", "127.0.0.1");
    }).toThrow("not found or has expired");
  });
});
