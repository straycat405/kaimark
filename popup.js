const state = { bookmarks: [], metadata: {}, selected: null, folders: [], view: "inbox" };
const $ = (id) => document.getElementById(id);
const listView = $("list-view"), editorView = $("editor-view"), list = $("bookmark-list"), status = $("status");

function getMetadata() {
  return new Promise((resolve) => chrome.storage.local.get({ metadata: {} }, ({ metadata }) => resolve(metadata)));
}
function saveMetadata(metadata) {
  return new Promise((resolve) => chrome.storage.local.set({ metadata }, resolve));
}
function getRecent() {
  return new Promise((resolve) => chrome.bookmarks.getRecent(50, resolve));
}
function getTree() {
  return new Promise((resolve) => chrome.bookmarks.getTree(resolve));
}
function moveBookmark(id, parentId) {
  return new Promise((resolve) => chrome.bookmarks.move(id, { parentId }, resolve));
}
function createFolder(parentId, title) {
  return new Promise((resolve) => chrome.bookmarks.create({ parentId, title }, resolve));
}
function toast(message) {
  const target = $("toast"); target.textContent = message; target.hidden = false;
  window.setTimeout(() => { target.hidden = true; }, 1800);
}
function flattenFolders(nodes, depth = 0, output = []) {
  for (const node of nodes) {
    if (!node.url && node.id !== "0") {
      const title = node.title || "기타 북마크";
      output.push({ id: node.id, title, optionLabel: `${"　".repeat(Math.max(depth - 1, 0))}${title}` });
    }
    if (node.children) flattenFolders(node.children, depth + 1, output);
  }
  return output;
}
function folderName(id) { return state.folders.find((folder) => folder.id === id)?.title || "폴더 없음"; }
function isOrganized(bookmark) {
  const meta = state.metadata[bookmark.id];
  return Boolean(meta && (meta.organizedAt || Object.hasOwn(meta, "title") || Object.hasOwn(meta, "note")));
}
function formatSavedAt(dateAdded) {
  if (!dateAdded) return "저장일 없음";
  const diffMinutes = Math.floor((Date.now() - dateAdded) / 60000);
  if (diffMinutes < 1) return "방금 저장";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}시간 전`;
  if (diffMinutes < 7 * 1440) return `${Math.floor(diffMinutes / 1440)}일 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(dateAdded));
}
function openCurrent(url) { chrome.tabs.update({ url }); window.close(); }
function openNew(url) { chrome.tabs.create({ url }); }
function renderList() {
  const query = $("search-input").value.trim().toLowerCase();
  const inbox = state.bookmarks.filter((bookmark) => !isOrganized(bookmark));
  const source = state.view === "inbox" ? inbox : state.bookmarks;
  const visible = source.filter((bookmark) => {
    const meta = state.metadata[bookmark.id] || {};
    return [bookmark.title, meta.title, meta.note, folderName(bookmark.parentId)].join(" ").toLowerCase().includes(query);
  });
  $("inbox-count").textContent = inbox.length;
  status.textContent = query ? `${visible.length}개 검색 결과` : state.view === "inbox" ? `분류하지 않음 ${visible.length}개` : `최근 저장 ${visible.length}개`;
  list.replaceChildren(...visible.map((bookmark) => createRow(bookmark)));
  if (!visible.length) list.innerHTML = `<li class="status">${query ? "일치하는 북마크가 없습니다." : state.view === "inbox" ? "분류하지 않은 북마크가 없습니다. 새 북마크를 저장하면 여기에 나타납니다." : "최근 북마크가 없습니다."}</li>`;
}
function createRow(bookmark) {
  const meta = state.metadata[bookmark.id] || {};
  const item = document.createElement("li"); item.className = "bookmark-row";
  const favicon = createFavicon(bookmark.url, meta.title || bookmark.title);
  const main = document.createElement("button"); main.className = "bookmark-main"; main.type = "button";
  main.innerHTML = `<div class="bookmark-title">${escapeHtml(meta.title || bookmark.title)}</div>${meta.note ? `<div class="bookmark-note">${escapeHtml(meta.note)}</div>` : ""}<div class="bookmark-meta"><span class="folder-location"><svg class="folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h6l2 2h9v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 9h17"/></svg><span class="bookmark-folder">${escapeHtml(folderName(bookmark.parentId))}</span></span><span class="bookmark-divider" aria-hidden="true">·</span><time class="bookmark-time">${escapeHtml(formatSavedAt(bookmark.dateAdded))}</time></div>`;
  main.addEventListener("click", () => openCurrent(bookmark.url));
  const actions = document.createElement("div"); actions.className = "bookmark-actions";
  actions.append(actionButton("✎", "편집", () => openEditor(bookmark)), actionButton("↗", "새 탭에서 열기", () => openNew(bookmark.url)));
  item.append(favicon, main, actions); return item;
}
function createFavicon(url, title) {
  const wrapper = document.createElement("div"); wrapper.className = "bookmark-favicon";
  const fallback = () => { wrapper.replaceChildren(document.createTextNode((title || "?").trim().slice(0, 1).toUpperCase() || "?")); };
  const image = document.createElement("img"); image.alt = "";
  const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
  faviconUrl.searchParams.set("pageUrl", url); faviconUrl.searchParams.set("size", "32");
  image.src = faviconUrl.toString();
  image.addEventListener("error", fallback, { once: true });
  wrapper.append(image); return wrapper;
}
function escapeHtml(value = "") { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function actionButton(label, name, handler) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.title = name; button.setAttribute("aria-label", name); button.addEventListener("click", handler); return button; }
function openEditor(bookmark) {
  state.selected = bookmark; const meta = state.metadata[bookmark.id] || {};
  $("title-input").value = meta.title || bookmark.title; $("note-input").value = meta.note || ""; $("original-title").textContent = `원본: ${bookmark.title}`;
  $("folder-select").replaceChildren(...state.folders.map((folder) => new Option(folder.optionLabel, folder.id, false, folder.id === bookmark.parentId)));
  listView.hidden = true; editorView.hidden = false; $("title-input").focus();
}
function closeEditor() { editorView.hidden = true; listView.hidden = false; state.selected = null; renderList(); }
async function load() {
  status.textContent = "북마크를 불러오는 중…";
  const [bookmarks, metadata, tree] = await Promise.all([getRecent(), getMetadata(), getTree()]);
  state.bookmarks = bookmarks.filter((bookmark) => bookmark.url); state.metadata = metadata; state.folders = flattenFolders(tree); renderList();
}
$("help-button").addEventListener("click", () => { $("help").hidden = !$("help").hidden; });
$("refresh-button").addEventListener("click", load); $("search-input").addEventListener("input", renderList); $("back-button").addEventListener("click", closeEditor);
document.querySelectorAll(".view-tab").forEach((button) => button.addEventListener("click", () => {
  state.view = button.dataset.view;
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active));
  });
  const inbox = state.view === "inbox";
  $("view-title").textContent = inbox ? "분류하지 않음" : "최근 저장";
  $("view-description").textContent = inbox ? "새 북마크를 먼저 분류합니다." : "최근 저장한 북마크";
  renderList();
}));
$("create-folder").addEventListener("click", async () => {
  const title = window.prompt("새 폴더 이름");
  const parentId = $("folder-select").value;
  if (!title?.trim() || !parentId) return;
  const folder = await createFolder(parentId, title.trim());
  const tree = await getTree(); state.folders = flattenFolders(tree);
  $("folder-select").replaceChildren(...state.folders.map((item) => new Option(item.optionLabel, item.id, false, item.id === folder.id)));
  toast(`'${folder.title}' 폴더를 만들었습니다.`);
});
$("editor-form").addEventListener("submit", async (event) => {
  event.preventDefault(); if (!state.selected) return;
  const id = state.selected.id; state.metadata[id] = { title: $("title-input").value.trim(), note: $("note-input").value.trim(), organizedAt: state.metadata[id]?.organizedAt || new Date().toISOString() };
  await saveMetadata(state.metadata); const parentId = $("folder-select").value;
  if (parentId && parentId !== state.selected.parentId) await moveBookmark(id, parentId);
  await load(); toast("변경사항을 저장했습니다."); closeEditor();
});
$("open-current").addEventListener("click", () => state.selected && openCurrent(state.selected.url));
$("open-new").addEventListener("click", () => state.selected && openNew(state.selected.url));
load();
