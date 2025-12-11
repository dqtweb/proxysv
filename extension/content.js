// =============================
// CONFIG
// =============================
const defaultSelection = { CL: false, GL: false, VS: false };


// =============================
// APPLY SELECTION TO PAGE UI
// =============================
// Bạn implement tuỳ ý theo business logic
function applySelectionToPage(selection) {
  const { CL, GL, VS } = selection;

  // Debug
  console.log("applySelectionToPage()", selection);

  // Example demo UI (tự thay đổi theo logic của bạn):
  document.body.style.outline = CL ? "3px solid red" : "none";
  document.body.style.backgroundColor = GL ? "rgba(0,255,0,0.05)" : "white";

  if (VS) {
    console.log("VS option enabled");
  }
}


// =============================
// 1. LOAD DỮ LIỆU KHI TRANG MỚI MỞ
// =============================
chrome.storage.local.get("popupSelection", (data) => {
  const selection = data.popupSelection || { ...defaultSelection };
  console.log("Initial selection:", selection);

  applySelectionToPage(selection);
});


// =============================
// 2. NHẬN REALTIME EVENT TỪ POPUP
// =============================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SELECTION_UPDATED") {
    console.log("Realtime selection:", msg.payload);

    applySelectionToPage(msg.payload);
  }
});
