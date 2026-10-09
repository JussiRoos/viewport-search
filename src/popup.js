const $ = (id) => document.getElementById(id);

// The content script is injected on demand (activeTab), the first time the popup talks to a tab
async function inject(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
}

async function send(type, extra = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const msg = { type, ...extra };
    const state = await chrome.tabs.sendMessage(tab.id, msg)
      .catch(() => inject(tab.id).then(() => chrome.tabs.sendMessage(tab.id, msg)));
    render(state);
    return state;
  } catch {
    $("status").textContent = "Can't run on this page.";
  }
}

function render(s) {
  if (!s || !s.word) { $("status").textContent = ""; return; }
  $("status").textContent = s.count
    ? `${s.count} matches · ${s.inView} in view`
    : "No matches";
}

let searchTimer;

function runSearch() {
  clearTimeout(searchTimer); searchTimer = null;
  localStorage.setItem("mode", $("mode").value);
  return send("search", { word: $("word").value.trim(), mode: $("mode").value });
}

$("mode").value = localStorage.getItem("mode") || "partial";
$("mode").addEventListener("change", () => { if ($("word").value.trim()) runSearch(); });
// Search as you type, debounced so long pages aren't rescanned on every keystroke
$("word").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250); });
// Enter = next viewport, Shift+Enter = previous (flushes a pending search first)
$("word").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  if (searchTimer) await runSearch();
  send(e.shiftKey ? "prev" : "next");
});
$("next").addEventListener("click", () => send("next"));
$("prev").addEventListener("click", () => send("prev"));
$("clear").addEventListener("click", () => { $("word").value = ""; send("clear"); });

// Restore the previous search when the popup reopens
send("state").then((s) => { if (s?.word) { $("word").value = s.word; $("mode").value = s.mode; } });
