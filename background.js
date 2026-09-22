function collectIds(node, output = []) {
  output.push(node.id);
  (node.children || []).forEach((child) => collectIds(child, output));
  return output;
}

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  const removed = removeInfo?.node ? collectIds(removeInfo.node) : [id];
  chrome.storage.local.get({ metadata: {} }, ({ metadata }) => {
    const remaining = removed.filter((key) => key in metadata);
    if (!remaining.length) return;
    remaining.forEach((key) => delete metadata[key]);
    chrome.storage.local.set({ metadata });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.info("Kaimark MVP installed");
});
