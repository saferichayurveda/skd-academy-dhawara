const toggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "मेनू बंद करें" : "मेनू खोलें");
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

async function loadPublicGallery() {
  const grid = document.getElementById("publicMediaGrid");
  if (!grid) return;
  try {
    const response = await fetch("/api/media", { cache: "no-store" });
    if (!response.ok) throw new Error("गैलरी अभी तैयार की जा रही है।");
    const data = await response.json();
    grid.replaceChildren();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "gallery-message";
      empty.textContent = "अभी कोई फोटो या वीडियो प्रकाशित नहीं है। नई गतिविधियों की सामग्री जल्द जोड़ी जाएगी।";
      grid.appendChild(empty);
      return;
    }
    data.items.forEach((item) => {
      const figure = document.createElement("figure");
      figure.className = "public-media-card";
      const url = "/api/media/" + encodeURIComponent(item.key);
      let media;
      if (item.type && item.type.startsWith("video/")) {
        media = document.createElement("video");
        media.controls = true;
        media.preload = "metadata";
        media.playsInline = true;
      } else {
        media = document.createElement("img");
        media.loading = "lazy";
        media.alt = item.title || "विद्यालय की गतिविधि";
      }
      media.src = url;
      figure.appendChild(media);
      if (item.title) {
        const caption = document.createElement("figcaption");
        caption.textContent = item.title;
        figure.appendChild(caption);
      }
      grid.appendChild(figure);
    });
  } catch {
    grid.replaceChildren();
    const message = document.createElement("p");
    message.className = "gallery-message";
    message.textContent = "फोटो एवं वीडियो गैलरी सेटअप होने के बाद यहाँ दिखाई देंगे।";
    grid.appendChild(message);
  }
}
loadPublicGallery();