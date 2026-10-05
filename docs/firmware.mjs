export const API_BASE = "https://api.ipsw.me/v4";
export const SYSTEMS = { iPhone: "iOS", iPad: "iPadOS", Mac: "macOS" };

export function isValidVersion(version) {
  return /^\d{1,3}(?:\.\d{1,3}){1,3}$/.test(version);
}

export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

// Use the release timeline rather than guessing OS versions from model identifiers.
export function latestVersions(timeline) {
  const latest = {};
  for (const day of timeline) {
    for (const release of day.releases ?? []) {
      if (!Object.values(SYSTEMS).includes(release.type)) continue;
      const match = release.name?.match(/^(?:iOS|iPadOS|macOS) (\d+(?:\.\d+)+) \(/);
      if (!match) continue;
      const version = match[1];
      const current = latest[release.type];
      if (!current || compareVersions(version, current.version) > 0 ||
          (compareVersions(version, current.version) === 0 && release.date > current.date)) {
        latest[release.type] = { version, date: release.date };
      }
    }
  }
  return latest;
}

export function matchesDevice(identifier, type) {
  if (typeof identifier !== "string") return false;
  if (type === "iPhone") return /^iPhone\d+,\d+$/i.test(identifier);
  if (type === "iPad") return /^iPad\d+,\d+$/i.test(identifier);
  if (type === "Mac") return /^(?:Mac\d+,\d+|MacBook\w*\d+,\d+|iMac\w*\d+,\d+)$/i.test(identifier);
  return false;
}

export function appleDownloadURL(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const appleHost = ["apple.com", "cdn-apple.com"].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    if (!appleHost) return null;
    return url.href;
  } catch { return null; }
}

// Several devices can share one IPSW. Keep every device and signing state while
// presenting each download URL once, as the native app does.
export function groupFirmwares(firmwares, type) {
  const groups = new Map();
  for (const firmware of firmwares) {
    if (!matchesDevice(firmware.identifier, type)) continue;
    const url = appleDownloadURL(firmware.url);
    if (!url) continue;
    if (!groups.has(url)) groups.set(url, { url, firmwares: [] });
    groups.get(url).firmwares.push(firmware);
  }
  return [...groups.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export function signingStatus(firmwares) {
  if (firmwares.every(firmware => firmware.signed === true)) return "signed";
  if (firmwares.every(firmware => firmware.signed === false)) return "unsigned";
  return "mixed";
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" }).format(date);
}

export class APIError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

export async function fetchJSON(path, { signal, fetcher = fetch, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetcher(`${API_BASE}${path}`, { signal: controller.signal });
    if (!response.ok) throw new APIError(response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
