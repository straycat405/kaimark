chrome.bookmarks.onRemoved.addListener((id) => {
  chrome.storage.local.get({ metadata: {} }, ({ metadata }) => {
    if (!(id in metadata)) return;
    delete metadata[id];
    chrome.storage.local.set({ metadata });
  });
});

chrome.runtime.onInstalled.addListener(() => {
  console.info("Kaimark MVP installed");
});
