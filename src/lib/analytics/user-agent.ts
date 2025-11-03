const DEVICE_MOBILE_REGEX = /mobile|iphone|ipod|android.+mobile|windows phone/i;
const DEVICE_TABLET_REGEX = /ipad|tablet|android(?!.*mobile)/i;

export type DeviceCategory = "mobile" | "desktop" | "tablet";

export type UserAgentDimensions = {
  deviceType: DeviceCategory;
  os: string;
  browser: string;
};

function detectDeviceType(ua: string, fallback?: DeviceCategory): DeviceCategory {
  if (!ua) {
    return fallback ?? "desktop";
  }

  if (DEVICE_TABLET_REGEX.test(ua)) {
    return "tablet";
  }

  if (DEVICE_MOBILE_REGEX.test(ua)) {
    return "mobile";
  }

  return fallback ?? "desktop";
}

function detectOs(ua: string): string {
  if (!ua) {
    return "unknown";
  }
  if (/windows nt 10\./i.test(ua)) {
    return "Windows 10";
  }
  if (/windows nt 11\./i.test(ua)) {
    return "Windows 11";
  }
  if (/windows nt/i.test(ua)) {
    return "Windows";
  }
  if (/mac os x 10[._]\d+/i.test(ua)) {
    return "macOS";
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return "iOS";
  }
  if (/android/i.test(ua)) {
    return "Android";
  }
  if (/linux/i.test(ua)) {
    return "Linux";
  }
  return "unknown";
}

function detectBrowser(ua: string): string {
  if (!ua) {
    return "unknown";
  }
  if (/edg\//i.test(ua)) {
    return "Edge";
  }
  if (/chrome\//i.test(ua) && /safari\//i.test(ua)) {
    return "Chrome";
  }
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) {
    return "Safari";
  }
  if (/firefox\//i.test(ua)) {
    return "Firefox";
  }
  if (/opr\//i.test(ua)) {
    return "Opera";
  }
  return "unknown";
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function resolveUserAgentDimensions(
  userAgent: string,
  fallbackDevice?: DeviceCategory
): UserAgentDimensions {
  const normalizedUa = userAgent ?? "";
  const deviceType = detectDeviceType(normalizedUa, fallbackDevice);
  const os = truncate(detectOs(normalizedUa), 64);
  const browser = truncate(detectBrowser(normalizedUa), 64);

  return {
    deviceType,
    os,
    browser,
  };
}
