let adminLanguage = "hi";
try { adminLanguage = localStorage.getItem("skd-language") === "en" ? "en" : "hi"; } catch {}
const tr = (hi, en) => adminLanguage === "en" ? en : hi;
const statusBox = document.getElementById("status");
const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const uploadForm = document.getElementById("uploadForm");
const uploadBtn = document.getElementById("uploadBtn");
const mediaGrid = document.getElementById("mediaGrid");

function setAdminLanguage(language) {
  adminLanguage = language === "en" ? "en" : "hi";
  document.documentElement.lang = adminLanguage;
  document.querySelectorAll("[data-admin-lang]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.adminLang === adminLanguage)));
  const labels = {
    adminSubtitle: ["सुरक्षित फोटो एवं वीडियो Admin Panel", "Secure Photo & Video Admin Panel"],
    loginHeading: ["Admin Login", "Admin Login"],
    loginNote: ["यह पेज केवल अधिकृत व्यवस्थापक के लिए है। अपना पासवर्ड किसी से साझा न करें।", "This page is for authorised administrators only. Never share your password."],
    passwordLabel: ["Admin पासवर्ड", "Admin Password"],
    loginButton: ["सुरक्षित Login", "Secure Login"],
    backLink: ["← वेबसाइट पर जाएँ", "← Visit Website"],
    uploadHeading: ["फोटो / वीडियो अपलोड करें", "Upload Photos / Videos"],
    titleLabel: ["शीर्षक (वैकल्पिक)", "Title (optional)"],
    filesLabel: ["मोबाइल Gallery से फोटो या वीडियो चुनें", "Choose photos or videos from your phone gallery"],
    uploadNote: ["प्रत्येक फाइल अधिकतम 50 MB। फोटो: JPG, PNG, WEBP, GIF, AVIF। वीडियो: MP4, WEBM या MOV। अपलोड के लिए इंटरनेट चालू रखें।", "Maximum 50 MB per file. Photos: JPG, PNG, WEBP, GIF, AVIF. Videos: MP4, WEBM, or MOV. Keep your internet connection on."],
    uploadBtn: ["चुनी गई फाइलें अपलोड करें", "Upload Selected Files"],
    mediaHeading: ["प्रकाशित मीडिया", "Published Media"],
    refreshBtn: ["Refresh", "Refresh"],
    footerBackLink: ["← मुख्य वेबसाइट", "← Main Website"]
  };
  Object.entries(labels).forEach(([id, values]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = values[adminLanguage === "en" ? 1 : 0];
  });
  const titleInput = document.getElementById("title");
  if (titleInput) titleInput.placeholder = tr("जैसे: वार्षिकोत्सव 2026", "e.g. Annual Function 2026");
  const logout = document.getElementById("logoutBtn");
  if (logout) logout.textContent = "Logout";
  try { localStorage.setItem("skd-language", adminLanguage); } catch {}
}
document.querySelectorAll("[data-admin-lang]").forEach((button) => button.addEventListener("click", () => setAdminLanguage(button.dataset.adminLang)));

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
  if (!response.ok) throw new Error(data.error || tr("अनुरोध पूरा नहीं हुआ।", "The request could not be completed.") + " (" + response.status + ")");
  return data;
}
async function checkSession() {
  try {
    const data = await api("/api/session");
    showAdmin(data.authenticated);
    if (data.authenticated) {
      setStatus(tr("आप सुरक्षित Admin Login में हैं।", "You are securely logged in as admin."), "success");
      await loadMedia();
    } else {
      setStatus(tr("फोटो और वीडियो प्रबंधित करने के लिए Admin Login करें।", "Log in as admin to manage photos and videos."));
    }
  } catch (error) {
    showAdmin(false);
    setStatus(error.message + tr(" Cloudflare R2 और secrets की सेटिंग जाँचें।", " Check the Cloudflare R2 and secrets settings."), "error");
  }
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  setStatus(tr("Login जाँचा जा रहा है…", "Checking login…"));
  try {
    await api("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("password").value })
    });
    document.getElementById("password").value = "";
    showAdmin(true);
    setStatus(tr("Login सफल।", "Login successful."), "success");
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
  setStatus(tr("आप Logout हो गए हैं।", "You have logged out."));
});
uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = Array.from(document.getElementById("files").files || []);
  if (!files.length) return setStatus(tr("पहले Gallery से फोटो या वीडियो चुनें।", "First choose photos or videos from your gallery."), "error");
  uploadBtn.disabled = true;
  const title = document.getElementById("title").value.trim();
  let uploaded = 0;
  try {
    for (const file of files) {
      setStatus(tr("अपलोड हो रहा है: ", "Uploading: ") + file.name + "\n" + (uploaded + 1) + " / " + files.length);
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("title", title);
      await api("/api/media", { method: "POST", body: form });
      uploaded++;
    }
    uploadForm.reset();
    setStatus(uploaded + tr(" फाइल सफलतापूर्वक अपलोड हुईं।", " file(s) uploaded successfully."), "success");
    await loadMedia();
  } catch (error) {
    setStatus(uploaded + tr(" फाइल अपलोड हुईं। बाकी अपलोड नहीं हो सकीं: ", " file(s) uploaded. The remaining files failed: ") + error.message, "error");
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
    preview.alt = item.title || tr("विद्यालय की फोटो", "School photo");
  }
  preview.className = "preview";
  preview.src = src;
  card.appendChild(preview);
  const info = document.createElement("div");
  info.className = "item-info";
  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = item.title || (item.type && item.type.startsWith("video/") ? tr("वीडियो", "Video") : tr("फोटो", "Photo"));
  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = formatSize(item.size || 0) + " · " + (item.uploadedAt ? new Date(item.uploadedAt).toLocaleDateString(adminLanguage === "en" ? "en-IN" : "hi-IN") : "");
  const remove = document.createElement("button");
  remove.className = "btn danger";
  remove.type = "button";
  remove.textContent = tr("हटाएँ", "Delete");
  remove.addEventListener("click", async () => {
    if (!confirm(tr("क्या आप इस फोटो/वीडियो को स्थायी रूप से हटाना चाहते हैं?", "Do you want to permanently delete this photo/video?"))) return;
    remove.disabled = true;
    try {
      await api("/api/media/" + encodeURIComponent(item.key), { method: "DELETE" });
      card.remove();
      setStatus(tr("मीडिया हटा दिया गया।", "Media deleted."), "success");
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
      empty.textContent = tr("अभी कोई फोटो या वीडियो प्रकाशित नहीं है। ऊपर से फाइलें अपलोड करें।", "No photos or videos have been published yet. Upload files above.");
      mediaGrid.appendChild(empty);
      return;
    }
    data.items.forEach((item) => mediaGrid.appendChild(createItem(item)));
  } catch (error) {
    setStatus(error.message, "error");
  }
}
setAdminLanguage(adminLanguage);
checkSession();