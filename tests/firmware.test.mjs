import test from "node:test";
import assert from "node:assert/strict";
import { APIError, isValidVersion, compareVersions, latestVersions, matchesDevice, appleDownloadURL, groupFirmwares, signingStatus, formatSize, fetchJSON } from "../docs/firmware.mjs";

test("complete version validation and numeric comparison", () => {
  for (const version of ["26.0", "18.2.1", "10.15.7"]) assert.equal(isValidVersion(version), true);
  for (const version of ["", "26", "../devices", "26.0 beta", "26.0?x", "26.0.1.2.3"]) assert.equal(isValidVersion(version), false);
  assert.ok(compareVersions("18.10", "18.9.2") > 0);
  assert.ok(compareVersions("27.0.1", "26.7.1") > 0);
  assert.equal(compareVersions("18.2", "18.2.0"), 0);
});

test("timeline chooses highest released version, excluding OTA and prereleases", () => {
  const releases = [
    { type: "iOS", name: "iOS 27.0.1 (24A1)", date: "2026-09-28" },
    { type: "iOS", name: "iOS 26.7.1 (23H1)", date: "2026-10-01" },
    { type: "iOS OTA", name: "iOS OTA 9.9.99.0 (99A1)" },
    { type: "iOS", name: "iOS 28.0 beta (25A1)" },
    { type: "iPadOS", name: "iPadOS 27.0 (24A2)", date: "2026-09-14" },
    { type: "macOS", name: "macOS 27.0.1 (26A1)", date: "2026-09-28" }
  ];
  const latest = latestVersions([{ releases }]);
  assert.equal(latest.iOS.version, "27.0.1");
  assert.equal(latest.iPadOS.version, "27.0");
  assert.equal(latest.macOS.version, "27.0.1");
  assert.deepEqual(latestVersions([]), {});
});

test("device classification keeps AppleTV and unrelated devices out", () => {
  assert.equal(matchesDevice("iPhone18,1", "iPhone"), true);
  assert.equal(matchesDevice("iPad16,4", "iPad"), true);
  for (const id of ["Mac14,2", "MacBookPro18,1", "iMac21,1"]) assert.equal(matchesDevice(id, "Mac"), true);
  assert.equal(matchesDevice("AppleTV14,1", "Mac"), false);
  assert.equal(matchesDevice("iPhone18,1", "iPad"), false);
  assert.equal(matchesDevice(undefined, "Mac"), false);
});

test("download URLs must belong to Apple and cannot contain credentials", () => {
  assert.ok(appleDownloadURL("https://updates.cdn-apple.com/file.ipsw"));
  assert.ok(appleDownloadURL("https://appldnld.apple.com/file.ipsw"));
  for (const url of ["javascript:alert(1)", "https://apple.com.evil.test/file", "https://cdn-apple.com.evil.test/file", "https://evilapple.com/file", "https://user:pass@apple.com/file"]) assert.equal(appleDownloadURL(url), null);
});

test("shared IPSWs deduplicate links while preserving devices and signing states", () => {
  const url = "https://appldnld.apple.com/shared.ipsw";
  const records = [
    { identifier: "iPad16,3", url, signed: true },
    { identifier: "iPad16,4", url, signed: false },
    { identifier: "iPhone18,1", url, signed: true },
    { identifier: "iPad16,5", url: "https://evil.test/a.ipsw", signed: true }
  ];
  const groups = groupFirmwares(records, "iPad");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].firmwares.length, 2);
  assert.equal(signingStatus(groups[0].firmwares), "mixed");
  assert.equal(signingStatus([{ signed: true }]), "signed");
  assert.equal(signingStatus([{ signed: false }]), "unsigned");
  assert.equal(signingStatus([{}]), "mixed");
  assert.equal(formatSize(10956292897), "10.96 GB");
});

test("API errors retain HTTP status for user-facing empty and rate limit states", async () => {
  await assert.rejects(fetchJSON("/ipsw/99.0", { fetcher: async () => ({ ok: false, status: 404 }) }), error => error instanceof APIError && error.status === 404);
  const result = await fetchJSON("/devices", { fetcher: async () => ({ ok: true, json: async () => [{ identifier: "iPhone18,1" }] }) });
  assert.equal(result[0].identifier, "iPhone18,1");
});

test("API timeout aborts a stalled request", async () => {
  const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  await assert.rejects(fetchJSON("/devices", { fetcher, timeout: 5 }), error => error.name === "AbortError");
});
