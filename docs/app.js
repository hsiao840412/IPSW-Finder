import { SYSTEMS, APIError, fetchJSON, isValidVersion, latestVersions, groupFirmwares, signingStatus, formatDate, formatSize, deviceReleaseDate } from "./firmware.mjs";

const $ = id => document.getElementById(id);
const state = { type: "iPhone", latest: {}, devices: new Map(), groups: [], request: null, generation: 0, latestRequest: 0 };
let toastTimer;

function icon(name) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  element.classList.add("icon");
  element.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  element.append(use);
  return element;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showEmpty(title, description) {
  $("empty-state").hidden = false;
  $("empty-title").textContent = title;
  $("empty-description").textContent = description;
}

function setBusy(busy) {
  $("search-button").disabled = busy;
  $("search-button-label").textContent = busy ? "查詢中…" : "查詢韌體";
  $("results-section").setAttribute("aria-busy", String(busy));
}

function resetResults() {
  state.groups = [];
  $("results").replaceChildren();
  $("result-count").hidden = true;
  $("results-description").hidden = true;
  $("search-error").hidden = true;
  $("copy-all").disabled = true;
  $("manual-copy").hidden = true;
}

function selectDevice(type, fillVersion = true) {
  if (!SYSTEMS[type]) return;
  state.request?.abort();
  state.generation++;
  state.type = type;
  document.querySelectorAll("[data-device]").forEach(button => {
    const selected = button.dataset.device === type;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (fillVersion) $("version").value = state.latest[SYSTEMS[type]]?.version ?? "";
  $("version").removeAttribute("aria-invalid");
  setBusy(false);
  resetResults();
  showEmpty("下載連結會顯示在這裡", "選好裝置與版本，即可開始查詢。");
  $("search-status").textContent = `已選擇 ${type}`;
}

async function loadLatest() {
  const request = ++state.latestRequest;
  $("retry-latest").disabled = true;
  try {
    const timeline = await fetchJSON("/releases");
    if (!Array.isArray(timeline)) throw new Error("Invalid timeline");
    if (request !== state.latestRequest) return;
    state.latest = latestVersions(timeline);
    for (const [type, system] of Object.entries(SYSTEMS)) {
      const latest = state.latest[system];
      const button = document.querySelector(`[data-latest="${type}"]`);
      button.disabled = !latest;
      button.setAttribute("aria-label", latest ? `使用 ${system} ${latest.version}` : `${system} 查無最新版本`);
      $(`latest-${type}`).textContent = latest?.version ?? "—";
      $(`latest-note-${type}`).textContent = latest ? "點選填入版本" : "查無資料";
    }
    $("latest-error").hidden = Object.keys(state.latest).length === 3;
    if (!$("version").value && document.activeElement !== $("version")) {
      $("version").value = state.latest[SYSTEMS[state.type]]?.version ?? "";
    }
  } catch {
    if (request !== state.latestRequest) return;
    $("latest-error").hidden = false;
    for (const type of Object.keys(SYSTEMS)) {
      if (!state.latest[SYSTEMS[type]]) $(`latest-note-${type}`).textContent = "暫時無法載入";
    }
  } finally { $("retry-latest").disabled = false; }
}

async function loadDeviceNames() {
  try {
    const devices = await fetchJSON("/devices");
    if (!Array.isArray(devices)) return;
    state.devices = new Map(devices.map(device => [device.identifier, device.name]));
    if (state.groups.length) renderResults();
  } catch { /* Model identifiers remain useful if the device directory is unavailable. */ }
}

function renderResults() {
  const fragment = document.createDocumentFragment();
  state.groups.forEach(group => {
    const firmware = group.firmwares[0];
    const card = node("article", "firmware-card");
    const top = node("div", "firmware-top");
    const name = node("div", "firmware-name");
    const fileIcon = node("span", "file-icon");
    fileIcon.append(icon("file"));
    const info = node("div");
    const fileName = new URL(group.url).pathname.split("/").pop();
    let readableName;
    try { readableName = decodeURIComponent(fileName); } catch { readableName = fileName; }
    info.append(node("h3", "", readableName || "IPSW 韌體"));
    const identifiers = [...new Set(group.firmwares.map(item => item.identifier))];
    const deviceLabel = id => `${state.devices.get(id) ?? id}${deviceReleaseDate(id) ? "" : "（發售日期未確認）"}`;
    const names = identifiers.map(deviceLabel);
    const preview = names.slice(0, 3).join(" · ") + (names.length > 3 ? ` 等 ${names.length} 款裝置` : "");
    info.append(node("p", "firmware-devices", preview));
    if (identifiers.length > 3) {
      const details = node("details", "device-details");
      details.append(node("summary", "", `查看全部 ${identifiers.length} 款裝置`));
      const list = node("ul");
      identifiers.forEach(id => list.append(node("li", "", `${deviceLabel(id)} · ${id}`)));
      details.append(list);
      info.append(details);
    }
    name.append(fileIcon, info);
    const status = signingStatus(group.firmwares);
    const signing = node("span", `signing ${status}`, { signed: "已簽署", unsigned: "未簽署", mixed: "依裝置而異／未確認" }[status]);
    top.append(name, signing);
    const bottom = node("div", "firmware-bottom");
    const meta = node("div", "firmware-meta");
    const builds = [...new Set(group.firmwares.map(item => item.buildid).filter(Boolean))];
    for (const text of [builds.length ? `Build ${builds.join(" / ")}` : "", formatSize(firmware.filesize), formatDate(firmware.releasedate)]) {
      if (text) meta.append(node("span", "", text));
    }
    const actions = node("div", "firmware-actions");
    const copy = node("button", "secondary-button");
    copy.type = "button";
    copy.append(icon("copy"), document.createTextNode("複製"));
    copy.setAttribute("aria-label", `複製 ${readableName} 的下載連結`);
    copy.addEventListener("click", () => copyLinks(group.url));
    const download = node("a", "secondary-button download-link");
    download.href = group.url;
    download.target = "_blank";
    download.rel = "noopener noreferrer";
    download.setAttribute("aria-label", `下載 ${readableName}`);
    download.append(icon("download"), document.createTextNode("下載"));
    actions.append(copy, download);
    bottom.append(meta, actions);
    card.append(top, bottom);
    fragment.append(card);
  });
  $("results").replaceChildren(fragment);
}

async function search(event) {
  event?.preventDefault();
  const version = $("version").value.trim();
  if (!isValidVersion(version)) {
    $("search-error").textContent = "請輸入完整版本號，例如 26.0 或 18.2.1。";
    $("search-error").hidden = false;
    $("version").setAttribute("aria-invalid", "true");
    $("version").focus();
    return;
  }
  state.request?.abort();
  const controller = new AbortController();
  state.request = controller;
  const generation = ++state.generation;
  const type = state.type;
  $("version").value = version;
  $("version").removeAttribute("aria-invalid");
  resetResults();
  setBusy(true);
  showEmpty("正在查詢韌體…", `${type} · ${SYSTEMS[type]} ${version}`);
  $("search-status").textContent = `正在查詢 ${type} ${version}`;
  try {
    const data = await fetchJSON(`/ipsw/${encodeURIComponent(version)}`, { signal: controller.signal });
    if (generation !== state.generation) return;
    if (!Array.isArray(data)) throw new Error("Invalid firmware response");
    state.groups = groupFirmwares(data, type);
    if (!state.groups.length) {
      showEmpty("找不到符合的韌體", `IPSW.me 尚未收錄 ${type} 的 ${version} 韌體，請確認版本號。`);
      $("search-status").textContent = "找不到符合的韌體";
      return;
    }
    $("empty-state").hidden = true;
    $("result-count").textContent = `${state.groups.length} 個檔案`;
    $("result-count").hidden = false;
    $("results-description").textContent = `${type} · ${SYSTEMS[type]} ${version} · 機型由新到舊 · 相同下載連結已合併`;
    $("results-description").hidden = false;
    $("copy-all").disabled = false;
    renderResults();
    $("search-status").textContent = `找到 ${state.groups.length} 個韌體檔案`;
  } catch (error) {
    if (generation !== state.generation || controller.signal.aborted) return;
    if (error instanceof APIError && error.status === 404) {
      showEmpty("找不到這個版本", `IPSW.me 尚未收錄 ${version}，請確認版本號後再試一次。`);
      $("search-status").textContent = "找不到這個版本";
    } else {
      $("search-error").textContent = error instanceof APIError && error.status === 429
        ? "查詢次數過多，請稍候再試。"
        : error.name === "AbortError" ? "查詢逾時，請再試一次。" : "無法取得韌體資料，請檢查網路後再試一次。";
      $("search-error").hidden = false;
      showEmpty("查詢未完成", "可保留目前的版本號，重新按下查詢。");
      $("search-status").textContent = $("search-error").textContent;
    }
  } finally {
    if (generation === state.generation) { setBusy(false); state.request = null; }
  }
}

async function copyLinks(text) {
  try {
    await navigator.clipboard.writeText(text);
    clearTimeout(toastTimer);
    $("toast").textContent = "下載連結已複製";
    $("toast").hidden = false;
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2400);
  } catch {
    $("manual-copy").hidden = false;
    $("manual-links").value = text;
    $("manual-links").focus();
    $("manual-links").select();
  }
}

document.querySelectorAll("[data-device]").forEach(button => button.addEventListener("click", () => selectDevice(button.dataset.device)));
document.querySelectorAll("[data-latest]").forEach(button => button.addEventListener("click", () => {
  selectDevice(button.dataset.latest);
  $("version").focus();
}));
$("search-form").addEventListener("submit", search);
$("version").addEventListener("input", () => { $("version").removeAttribute("aria-invalid"); });
$("copy-all").addEventListener("click", () => copyLinks(state.groups.map(group => group.url).join("\n")));
$("close-manual").addEventListener("click", () => { $("manual-copy").hidden = true; $("copy-all").focus(); });
$("retry-latest").addEventListener("click", loadLatest);
loadLatest();
loadDeviceNames();
