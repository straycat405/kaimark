const translations = {
  ko: {
    helpLabel: "사용 방법", settings: "설정", helpTitle: "저장한 북마크를 분류하고 관리하세요", helpDescription: "최근 저장한 북마크에 제목과 메모를 추가하고 폴더를 정리해 나중에 쉽게 찾으세요.",
    bookmarkManager: "북마크 관리자", refresh: "새로고침", recent: "최근 저장", searchPlaceholder: "내 제목, 메모, 원본 제목 검색",
    editBookmark: "북마크 편집", backToList: "목록으로", personalTitle: "1. 내 제목", noteLabel: "2. 저장 이유 / 메모", notePlaceholder: "왜 저장했는지, 언제 다시 쓸지", moveFolder: "3. 폴더 이동", createFolder: "+ 새 폴더 만들기", saveChanges: "변경사항 저장", openCurrent: "현재 탭", openNew: "새 탭 ↗",
    settingsDescription: "Kaimark 환경을 조절합니다.", appearance: "화면 모드", appearanceDescription: "Chrome 또는 기기 설정을 따르거나, 밝고 어두운 화면을 직접 고릅니다.", system: "시스템", light: "라이트", dark: "다크", language: "언어", languageDescription: "Kaimark에 표시할 언어를 고릅니다. 시스템은 Chrome 언어를 따릅니다.", reportBug: "버그 신고", changelog: "변경 이력",
    loading: "북마크를 불러오는 중…", recentDescription: "최근 저장한 북마크", searchResults: "{count}개 검색 결과", recentCount: "최근 저장 {count}개", noSearchResults: "일치하는 북마크가 없습니다.", noRecent: "최근 북마크가 없습니다.", noNote: "메모 없음", directOnBar: "북마크바에 직접", otherBookmarks: "기타 북마크", noFolder: "폴더 없음", noSavedDate: "저장일 없음", justNow: "방금 저장", minutesAgo: "{count}분 전", hoursAgo: "{count}시간 전", daysAgo: "{count}일 전", edit: "편집", openNewTab: "새 탭에서 열기", originalTitle: "원본: {title}", newFolderPrompt: "새 폴더 이름", changesSaved: "변경사항을 저장했습니다."
  },
  en: {
    helpLabel: "How to use", settings: "Settings", helpTitle: "Organize and rediscover your bookmarks", helpDescription: "Add a title and note to recent bookmarks, and organize them in folders so you can find them later.",
    bookmarkManager: "Bookmark Manager", refresh: "Refresh", recent: "Recent", searchPlaceholder: "Search titles, notes, and bookmarks",
    editBookmark: "Edit bookmark", backToList: "Back to list", personalTitle: "1. My title", noteLabel: "2. Why I saved it / note", notePlaceholder: "Why you saved this or when to use it", moveFolder: "3. Move to folder", createFolder: "+ Create folder", saveChanges: "Save changes", openCurrent: "Current tab", openNew: "New tab ↗",
    settingsDescription: "Personalize your Kaimark experience.", appearance: "Appearance", appearanceDescription: "Follow Chrome or your device, or choose a light or dark appearance.", system: "System", light: "Light", dark: "Dark", language: "Language", languageDescription: "Choose the language shown in Kaimark. System follows your Chrome language.", reportBug: "Report a Bug", changelog: "Changelog",
    loading: "Loading bookmarks…", recentDescription: "Recently saved bookmarks", searchResults: "{count} search results", recentCount: "{count} recent bookmarks", noSearchResults: "No matching bookmarks.", noRecent: "No recent bookmarks.", noNote: "No note", directOnBar: "On bookmarks bar", otherBookmarks: "Other bookmarks", noFolder: "No folder", noSavedDate: "No saved date", justNow: "Saved just now", minutesAgo: "{count}m ago", hoursAgo: "{count}h ago", daysAgo: "{count}d ago", edit: "Edit", openNewTab: "Open in new tab", originalTitle: "Original: {title}", newFolderPrompt: "New folder name", changesSaved: "Changes saved."
  }
};

const state = { bookmarks: [], metadata: {}, selected: null, folders: [], settings: { theme: "system", language: "system" } };
const $ = (id) => document.getElementById(id);
const listView = $("list-view"), editorView = $("editor-view"), list = $("bookmark-list"), status = $("status");
function resolveLanguage(language) { if (language === "ko" || language === "en") return language; return (chrome.i18n?.getUILanguage?.() || navigator.language || "en").toLowerCase().startsWith("ko") ? "ko" : "en"; }
function t(key, values = {}) { const value = translations[resolveLanguage(state.settings.language)]?.[key] ?? translations.en[key] ?? key; return Object.entries(values).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement), value); }
function getMetadata() { return new Promise((resolve) => chrome.storage.local.get({ metadata: {} }, ({ metadata }) => resolve(metadata))); }
function saveMetadata(metadata) { return new Promise((resolve) => chrome.storage.local.set({ metadata }, resolve)); }
function getSettings() { const defaults = { theme: "system", language: "system" }; return new Promise((resolve) => chrome.storage.local.get({ settings: defaults }, ({ settings }) => resolve({ ...defaults, ...settings }))); }
function saveSettings(settings) { return new Promise((resolve) => chrome.storage.local.set({ settings }, resolve)); }
function getRecent() { return new Promise((resolve) => chrome.bookmarks.getRecent(50, resolve)); }
function getTree() { return new Promise((resolve) => chrome.bookmarks.getTree(resolve)); }
function moveBookmark(id, parentId) { return new Promise((resolve) => chrome.bookmarks.move(id, { parentId }, resolve)); }
function createFolder(parentId, title) { return new Promise((resolve) => chrome.bookmarks.create({ parentId, title }, resolve)); }
function toast(message) { const target = $("toast"); target.textContent = message; target.hidden = false; window.setTimeout(() => { target.hidden = true; }, 1800); }
function flattenFolders(nodes, depth = 0, output = []) {
  for (const node of nodes) {
    const title = node.title || t("otherBookmarks");
    if (!node.url && node.id !== "0") output.push({ id: node.id, title, folderType: node.folderType, depth: Math.max(depth - 1, 0) });
    if (node.children) flattenFolders(node.children, depth + 1, output);
  }
  return output;
}
function folderName(id) {
  const folder = state.folders.find((item) => item.id === id);
  return folder?.folderType === "bookmarks-bar" ? t("directOnBar") : folder?.title || t("noFolder");
}
function folderOptionLabel(folder) { return `${"　".repeat(folder.depth)}${folderName(folder.id)}`; }
function formatSavedAt(dateAdded) {
  if (!dateAdded) return t("noSavedDate");
  const diffMinutes = Math.floor((Date.now() - dateAdded) / 60000);
  if (diffMinutes < 1) return t("justNow");
  if (diffMinutes < 60) return t("minutesAgo", { count: diffMinutes });
  if (diffMinutes < 1440) return t("hoursAgo", { count: Math.floor(diffMinutes / 60) });
  if (diffMinutes < 7 * 1440) return t("daysAgo", { count: Math.floor(diffMinutes / 1440) });
  return new Intl.DateTimeFormat(resolveLanguage(state.settings.language) === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric" }).format(new Date(dateAdded));
}
function openCurrent(url) { chrome.tabs.update({ url }); window.close(); }
function openNew(url) { chrome.tabs.create({ url }); }
function openBookmarkManager() { chrome.tabs.create({ url: "chrome://bookmarks/" }); window.close(); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme; document.querySelectorAll(".theme-toggle button[data-theme]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === theme))); }
function applyLanguage(language) {
  document.documentElement.lang = resolveLanguage(language);
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel)); });
  document.querySelectorAll(".theme-toggle button[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === language)));
  if (state.selected) $("original-title").textContent = t("originalTitle", { title: state.selected.title });
  renderList();
}
function renderList() {
  const query = $("search-input").value.trim().toLowerCase();
  const visible = state.bookmarks.filter((bookmark) => { const meta = state.metadata[bookmark.id] || {}; return [bookmark.title, meta.title, meta.note, folderName(bookmark.parentId)].join(" ").toLowerCase().includes(query); });
  status.textContent = query ? t("searchResults", { count: visible.length }) : t("recentCount", { count: visible.length });
  list.replaceChildren(...visible.map((bookmark) => createRow(bookmark)));
  if (!visible.length) { const empty = document.createElement("li"); empty.className = "status"; empty.textContent = query ? t("noSearchResults") : t("noRecent"); list.append(empty); }
}
function createRow(bookmark) {
  const meta = state.metadata[bookmark.id] || {};
  const item = document.createElement("li"); item.className = "bookmark-row";
  const favicon = createFavicon(bookmark.url, meta.title || bookmark.title);
  const main = document.createElement("button"); main.className = "bookmark-main"; main.type = "button";
  main.innerHTML = `<div class="bookmark-title">${escapeHtml(meta.title || bookmark.title)}</div><div class="bookmark-note${meta.note?.trim() ? "" : " is-empty"}">${escapeHtml(meta.note?.trim() || t("noNote"))}</div><div class="bookmark-meta"><span class="folder-location"><svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 9h17"/></svg><span class="bookmark-folder">${escapeHtml(folderName(bookmark.parentId))}</span></span><span class="bookmark-divider" aria-hidden="true">·</span><time class="bookmark-time">${escapeHtml(formatSavedAt(bookmark.dateAdded))}</time></div>`;
  main.addEventListener("click", () => openCurrent(bookmark.url));
  const actions = document.createElement("div"); actions.className = "bookmark-actions";
  actions.append(actionButton("✎", t("edit"), () => openEditor(bookmark)), actionButton("↗", t("openNewTab"), () => openNew(bookmark.url)));
  item.append(favicon, main, actions); return item;
}
function createFavicon(url, title) {
  const wrapper = document.createElement("div"); wrapper.className = "bookmark-favicon";
  const fallback = () => { wrapper.replaceChildren(document.createTextNode((title || "?").trim().slice(0, 1).toUpperCase() || "?")); };
  const image = document.createElement("img"); image.alt = "";
  const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/")); faviconUrl.searchParams.set("pageUrl", url); faviconUrl.searchParams.set("size", "32");
  image.src = faviconUrl.toString(); image.addEventListener("error", fallback, { once: true }); wrapper.append(image); return wrapper;
}
function escapeHtml(value = "") { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function actionButton(label, name, handler) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.title = name; button.setAttribute("aria-label", name); button.addEventListener("click", handler); return button; }
function openEditor(bookmark) {
  state.selected = bookmark; const meta = state.metadata[bookmark.id] || {};
  $("title-input").value = meta.title || bookmark.title; $("note-input").value = meta.note || ""; $("original-title").textContent = t("originalTitle", { title: bookmark.title });
  $("folder-select").replaceChildren(...state.folders.map((folder) => new Option(folderOptionLabel(folder), folder.id, false, folder.id === bookmark.parentId)));
  listView.hidden = true; editorView.hidden = false; $("title-input").focus();
}
function closeEditor() { editorView.hidden = true; listView.hidden = false; state.selected = null; renderList(); }
function openSettings() { listView.hidden = true; editorView.hidden = true; $("settings-view").hidden = false; applyTheme(state.settings.theme); }
function closeSettings() { $("settings-view").hidden = true; listView.hidden = false; }
async function load() {
  status.textContent = t("loading");
  const [bookmarks, metadata, tree, settings] = await Promise.all([getRecent(), getMetadata(), getTree(), getSettings()]);
  state.bookmarks = bookmarks.filter((bookmark) => bookmark.url); state.metadata = metadata; state.settings = settings; state.folders = flattenFolders(tree); applyTheme(settings.theme); applyLanguage(settings.language);
}

$("help-button").addEventListener("click", () => { $("help").hidden = !$("help").hidden; });
$("settings-button").addEventListener("click", openSettings); $("settings-back-button").addEventListener("click", closeSettings);
$("bookmark-manager-button").addEventListener("click", openBookmarkManager);
$("refresh-button").addEventListener("click", load); $("search-input").addEventListener("input", renderList); $("back-button").addEventListener("click", closeEditor);
document.querySelectorAll(".theme-toggle button[data-theme]").forEach((button) => button.addEventListener("click", async () => { const theme = button.dataset.theme; state.settings = { ...state.settings, theme }; applyTheme(theme); await saveSettings(state.settings); }));
document.querySelectorAll(".theme-toggle button[data-language]").forEach((button) => button.addEventListener("click", async () => { const language = button.dataset.language; state.settings = { ...state.settings, language }; applyLanguage(language); await saveSettings(state.settings); }));
$("create-folder").addEventListener("click", async () => {
  const title = window.prompt(t("newFolderPrompt")); const parentId = $("folder-select").value;
  if (!title?.trim() || !parentId) return;
  const folder = await createFolder(parentId, title.trim()); const tree = await getTree(); state.folders = flattenFolders(tree);
  $("folder-select").replaceChildren(...state.folders.map((item) => new Option(folderOptionLabel(item), item.id, false, item.id === folder.id)));
});
$("editor-form").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!state.selected) return;
  const id = state.selected.id; state.metadata[id] = { title: $("title-input").value.trim(), note: $("note-input").value.trim(), organizedAt: state.metadata[id]?.organizedAt || new Date().toISOString() };
  await saveMetadata(state.metadata); const parentId = $("folder-select").value;
  if (parentId && parentId !== state.selected.parentId) await moveBookmark(id, parentId);
  await load(); toast(t("changesSaved")); closeEditor();
});
$("open-current").addEventListener("click", () => state.selected && openCurrent(state.selected.url));
$("open-new").addEventListener("click", () => state.selected && openNew(state.selected.url));
load();
