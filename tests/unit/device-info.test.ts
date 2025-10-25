import { describe, expect, it } from "vitest";

import { deriveDeviceInfo } from "@/lib/device-info";

describe("deriveDeviceInfo", () => {
  it("returns unknown info when user agent missing", () => {
    expect(deriveDeviceInfo(null)).toEqual({
      userAgent: "unknown",
      deviceType: "unknown",
    });
  });

  it("detects mobile devices", () => {
    const info = deriveDeviceInfo(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    );
    expect(info.deviceType).toBe("mobile");
    expect(info.browser).toBe("Safari");
    expect(info.os).toBe("iOS");
  });

  it("detects bots", () => {
    const info = deriveDeviceInfo("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(info.deviceType).toBe("bot");
    expect(info.browser).toBeUndefined();
  });

  it("identifies browser and os for desktop agent", () => {
    const info = deriveDeviceInfo(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(info.deviceType).toBe("desktop");
    expect(info.browser).toBe("Chrome");
    expect(info.os).toBe("Windows 10");
  });
});

