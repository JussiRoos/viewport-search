// Relays keyboard shortcuts to the content script of the active tab.
chrome.commands.onCommand.addListener(async (command) => {
  const type = { "next-viewport": "next", "prev-viewport": "prev" }[command];
  if (!type) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type }).catch(() => {});
});
