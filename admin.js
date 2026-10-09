const statusBox = document.getElementById("status");
const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const uploadForm = document.getElementById("uploadForm");
const uploadBtn = document.getElementById("uploadBtn");
const mediaGrid = document.getElementById("mediaGrid");

function setStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = "status" + (type ? " " + type : "");
}
function showAdmin(authenticated) {
  loginPanel.classList.toggle("hidden", authenticated);
  adminPanel.classList.toggle("hidden", !authenticated);
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "अनुरोध पूरा नहीं हुआ। (" + response.status + ")");
  return data;
}
async function checkSession() {
  try {
    const data = await api("/api/session");
    showAdmin(data.authenticated);
    if (data.authenticated) {
      setStatus("आप सुरक्षित Admin Login में हैं।", "success");
      await loadMedia();
    } else {
      setStatus("फोटो और वीडियो प्रबंधित करने के लिए Admin Login करें।");
    }
  } catch (error) {
    showAdmin(false);
    setStatus(error.message + " Cloudflare R2 और secrets की सेटिंग जाँचें।", "error");
  }
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus("Login जाँचा जा रहा है…");
  try {
    await api("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    });
    document.getElementById("password").value = "";
    showAdmin(true);
    setStatus("Login सफल।", "success");
    await loadMedia();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try { await api("/api/session", { method: "DELETE" }); } catch {}
  showAdmin(false);
  setStatus("आप Logout हो गए हैं।");
});
uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = Array.from(document.getElementById("files").files || []);
  if (!files.length) return setStatus("पहले Gallery से फोटो या वीडियो चुनें।", "error");
  uploadBtn.disabled = true;
  const title = document.getElementById("title").value.trim();
  let uploaded = 0;
  try {
    for (const file of files) {
      setStatus("अपलोड हो रहा है: " + file.name + "\n" + (uploaded + 1) + " / " + files.length);
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("title", title);
      await api("/api/media", { method: "POST", body: form });
      uploaded++;
    }
    uploadForm.reset();
    setStatus(uploaded + " फाइल सफलतापूर्वक अपलोड हुईं।", "success");
    await loadMedia();
  } catch (error) {
    setStatus(uploaded + " फाइल अपलोड हुईं। बाकी अपलोड नहीं हो सकीं: " + error.message, "error");
    await loadMedia();
  } finally {
    uploadBtn.disabled = false;
  }
});
document.getElementById("refreshBtn").addEventListener("click", loadMedia);

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function createItem(item) {
  const card = document.createElement("article");
  card.className = "item";
  const src = "/api/media/" + encodeURIComponent(item.key);
  let preview;
  if (item.type && item.type.startsWith("video/")) {
    preview = document.createElement("video");
    preview.controls = true;
    preview.preload = "metadata";
    preview.playsInline = true;
  } else {
    preview = document.createElement("img");
    preview.loading = "lazy";
    preview.alt = item.title || "विद्यालय की फोटो";
  }
  preview.className = "preview";
  preview.src = src;
  card.appendChild(preview);
  const info = document.createElement("div");
  info.className = "item-info";
  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = item.title || (item.type && item.type.startsWith("video/") ? "वीडियो" : "फोटो");
  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = formatSize(item.size || 0) + " · " + (item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString("hi-IN") : "");
  const remove = document.createElement("button");
  remove.className = "btn danger";
  remove.type = "button";
  remove.textContent = "हटाएँ";
  remove.addEventListener("click", async () => {
    if (!confirm("क्या आप इस फोटो/वीडियो को स्थायी रूप से हटाना चाहते हैं?")) return;
    remove.disabled = true;
    try {
      await api("/api/media/" + encodeURIComponent(item.key), { method: "DELETE" });
      card.remove();
      setStatus("मीडिया हटा दिया गया।", "success");
    } catch (error) {
      setStatus(error.message, "error");
      remove.disabled = false;
    }
  });
  info.append(title, meta, remove);
  card.appendChild(info);
  return card;
}
async function loadMedia() {
  mediaGrid.replaceChildren();
  try {
    const data = await api("/api/media");
    if (!data.items || !data.items.length) {
      const empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = "अभी कोई फोटो या वीडियो प्रकाशित नहीं है। ऊपर से फाइलें अपलोड करें।";
      mediaGrid.appendChild(empty);
      return;
    }
    data.items.forEach((item) => mediaGrid.appendChild(createItem(item)));
  } catch (error) {
    setStatus(error.message, "error");
  }
}
checkSession();