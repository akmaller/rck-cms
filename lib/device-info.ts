export type DeviceInfo = {
  userAgent: string;
  browser?: string;
  os?: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
};

export function deriveDeviceInfo(userAgentHeader: string | null | undefined): DeviceInfo {
  if (!userAgentHeader) {
    return { userAgent: "unknown", deviceType: "unknown" };
  }

  const userAgent = userAgentHeader.trim();
  if (!userAgent) {
    return { userAgent: "unknown", deviceType: "unknown" };
  }

  const uaLower = userAgent.toLowerCase();

  let deviceType: DeviceInfo["deviceType"] = "desktop";
  if (/bot|crawl|spider|slurp|mediapartners/i.test(userAgent)) {
    deviceType = "bot";
  } else if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|android/i.test(userAgent)) {
    deviceType = "mobile";
  }

  const browserDetectors: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /edg\/(\d+[\d.]*)/i, name: "Edge" },
    { pattern: /chrome\/(\d+[\d.]*)/i, name: "Chrome" },
    { pattern: /safari\/(\d+[\d.]*)/i, name: "Safari" },
    { pattern: /firefox\/(\d+[\d.]*)/i, name: "Firefox" },
    { pattern: /opr\/(\d+[\d.]*)/i, name: "Opera" },
    { pattern: /msie\s(\d+[\d.]*)/i, name: "IE" },
    { pattern: /trident\/.*rv:(\d+[\d.]*)/i, name: "IE" },
  ];

  const browserMatch = browserDetectors.find(({ pattern }) => pattern.test(userAgent));
  const browser = browserMatch ? browserMatch.name : undefined;

  let os: string | undefined;
  if (/windows nt 11/i.test(userAgent)) os = "Windows 11";
  else if (/windows nt 10/i.test(userAgent)) os = "Windows 10";
  else if (/windows nt 6\.3/i.test(userAgent)) os = "Windows 8.1";
  else if (/windows nt 6\.2/i.test(userAgent)) os = "Windows 8";
  else if (/windows nt 6\.1/i.test(userAgent)) os = "Windows 7";
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/mac os x 10[_\.]15/i.test(userAgent)) os = "macOS Catalina";
  else if (/mac os x 10[_\.]14/i.test(userAgent)) os = "macOS Mojave";
  else if (/mac os x/i.test(userAgent)) os = "macOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/linux/i.test(uaLower)) os = "Linux";
  else if (/cros/i.test(userAgent)) os = "Chrome OS";

  return {
    userAgent,
    browser,
    os,
    deviceType,
  };
}
