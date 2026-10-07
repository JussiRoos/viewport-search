const $ = (id) => document.getElementById(id);

async function send(type, extra = {}) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const state = await chrome.tabs.sendMessage(tab.id, { type, ...extra });
    render(state);
    return state;
  } catch {
    $("status").textContent = "Can't run on this page (try reloading it).";
  }
}

function render(s) {
  if (!s || !s.word) { $("status").textContent = ""; return; }
  $("status").textContent = s.count
    ? `${s.count} matches · ${s.inView} in view`
    : "No matches";
}

function runSearch() {
  localStorage.setItem("mode", $("mode").value);
  return send("search", { word: $("word").value.trim(), mode: $("mode").value });
}

$("mode").value = localStorage.getItem("mode") || "partial";
$("mode").addEventListener("change", () => { if ($("word").value.trim()) runSearch(); });
$("word").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
$("next").addEventListener("click", () => send("next"));
$("prev").addEventListener("click", () => send("prev"));
$("clear").addEventListener("click", () => { $("word").value = ""; send("clear"); });

// Restore the previous search when the popup reopens
send("state").then((s) => { if (s?.word) { $("word").value = s.word; $("mode").value = s.mode; } });
