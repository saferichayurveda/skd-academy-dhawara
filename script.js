const toggle = document.getElementById("menuToggle");
const nav = document.getElementById("mainNav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? (currentLanguage === "en" ? "Close menu" : "मेनू बंद करें") : (currentLanguage === "en" ? "Open menu" : "मेनू खोलें"));
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}
const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

let currentLanguage = "hi";
try { currentLanguage = localStorage.getItem("skd-language") === "en" ? "en" : "hi"; } catch {}

const translations = {
  "nav": [["होम","विद्यालय परिचय","कक्षाएँ","प्रवेश","नोटिस बोर्ड","फोटो/वीडियो","संपर्क"],["Home","About School","Classes","Admissions","Notice Board","Photos/Videos","Contact"]],
  "heroEyebrow": ["ज्ञान · अनुशासन · उज्ज्वल भविष्य","Knowledge · Discipline · Bright Future"],
  "heroTitle": ["आपका स्वागत है<br><span>S. K. D. Academy, Dhawara</span> में","Welcome to<br><span>S. K. D. Academy, Dhawara</span>"],
  "heroText": ["कक्षा 1 से 10 तक शिक्षा के लिए विद्यालय की जानकारी, प्रवेश विवरण और महत्वपूर्ण सूचनाएँ एक ही स्थान पर।","Find school information, admission details, and important updates for Classes 1–10 in one place."],
  "heroButtons": [["प्रवेश जानकारी","हमसे संपर्क करें"],["Admission Information","Contact Us"]],
  "ribbon": ["सीखें • आगे बढ़ें • सफल बनें","Learn • Grow • Succeed"],
  "quickStrong": [["प्रवेश प्रक्रिया","नोटिस बोर्ड","कक्षा 1–10","संपर्क"],["Admissions","Notice Board","Classes 1–10","Contact"]],
  "quickSmall": [["आवश्यक जानकारी","विद्यालय की सूचनाएँ","कक्षावार जानकारी","पता और सहायता"],["Admission information","School updates","Class-wise information","Address and help"]],
  "sectionEyebrows": [["हमारे विद्यालय के बारे में","शैक्षिक जानकारी","नए विद्यार्थियों के लिए","अभिभावकों के लिए","विद्यालय की गतिविधियाँ","हमसे जुड़ें"],["About Our School","Academic Information","For New Students","For Parents","School Activities","Get in Touch"]],
  "sectionTitles": [["शिक्षा और विकास की ओर एक कदम","कक्षा 1 से 10 तक","प्रवेश प्रक्रिया","नोटिस बोर्ड","फोटो एवं वीडियो गैलरी","संपर्क एवं पता"],["A Step Towards Education and Growth","Classes 1 to 10","Admission Process","Notice Board","Photo & Video Gallery","Contact & Address"]],
  "sectionTexts": [["विद्यालय से संबंधित प्रमाणित जानकारी यहाँ साझा की जाएगी।","कक्षावार पाठ्यक्रम, समय-सारणी और अन्य विवरण विद्यालय द्वारा उपलब्ध होने पर जोड़े जाएँगे।","प्रवेश संबंधी अंतिम नियम और दस्तावेज विद्यालय कार्यालय से सत्यापित कराएँ।","नई सूचनाएँ विद्यालय से पुष्टि के बाद यहाँ प्रकाशित की जाएँगी।","विद्यालय के कार्यक्रमों, गतिविधियों और समारोहों की तस्वीरें एवं वीडियो यहाँ देखिए।"],["Verified information about the school will be shared here.","Class-wise curriculum, timetables, and other details will be added when provided by the school.","Please verify the final admission rules and required documents with the school office.","New notices will be published here after confirmation by the school.","View photos and videos of school events, activities, and celebrations here."]],
  "aboutTitles": [["हमारा उद्देश्य","हमारा दृष्टिकोण","विद्यालय की जानकारी"],["Our Mission","Our Vision","School Information"]],
  "aboutTexts": [["विद्यार्थियों के शैक्षिक विकास, अनुशासन और सीखने के प्रति रुचि को प्रोत्साहित करना।","विद्यार्थियों और अभिभावकों के लिए स्पष्ट, उपयोगी और समय पर विद्यालयी जानकारी उपलब्ध कराना।","उत्तर प्रदेश में मान्यता प्राप्त विद्यालय; कक्षा 1 से 10 तक की पढ़ाई।"],["To encourage students’ academic growth, discipline, and interest in learning.","To provide clear, useful, and timely school information for students and parents.","A recognised school in Uttar Pradesh, offering education from Classes 1 to 10."]],
  "classNames": [["कक्षा 1","कक्षा 2","कक्षा 3","कक्षा 4","कक्षा 5","कक्षा 6","कक्षा 7","कक्षा 8","कक्षा 9","कक्षा 10"],["Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10"]],
  "admissionTitle": ["प्रवेश के लिए संपर्क करें","Contact Us for Admissions"],
  "admissionText": ["कक्षा, सीट उपलब्धता, शुल्क और आवश्यक दस्तावेजों की जानकारी के लिए विद्यालय से संपर्क करें।","Contact the school for information about classes, seat availability, fees, and required documents."],
  "admissionList": [["विद्यार्थी का नाम और जन्मतिथि","अभिभावक का संपर्क विवरण","पूर्व विद्यालय का विवरण, जहाँ लागू हो","आवश्यक प्रमाण-पत्रों की सूची कार्यालय से पुष्टि करें"],["Student’s name and date of birth","Parent/guardian contact details","Previous school details, where applicable","Confirm the required documents with the school office"]],
  "contactDetails": [["संपर्क विवरण देखें","जल्द ही महत्वपूर्ण सूचनाएँ यहाँ उपलब्ध होंगी","फीस, छुट्टियों, परीक्षा कार्यक्रम और अभिभावक बैठकों की सूचना इस स्थान पर जोड़ी जाएगी。"],["View Contact Details","Important notices will be available here soon","Fee updates, holidays, exam schedules, and parent meeting notices will be posted here."]],
  "galleryAdmin": ["· केवल अधिकृत व्यवस्थापक के लिए","· Authorised administrators only"],
  "contactAddress": ["धवारा, पोस्ट करीतिन, जनपद कुशीनगर, उत्तर प्रदेश, भारत","Dhawara, Post Karitin, Kushinagar District, Uttar Pradesh, India"],
  "contactNote": ["विद्यालय का फोन नंबर और सटीक मानचित्र लोकेशन पुष्टि के बाद जोड़ी जाएगी।","The school phone number and exact map location will be added after confirmation."],
  "mapButton": ["Google Maps पर खोजें ↗","Find us on Google Maps ↗"],
  "footerAddress": ["धवारा, जनपद कुशीनगर, उत्तर प्रदेश","Dhawara, Kushinagar District, Uttar Pradesh"],
  "galleryLoading": ["गैलरी लोड हो रही है…","Loading gallery…"],
  "galleryEmpty": ["अभी कोई फोटो या वीडियो प्रकाशित नहीं है। नई गतिविधियों की सामग्री जल्द जोड़ी जाएगी।","No photos or videos have been published yet. New school activity media will be added soon."],
  "galleryError": ["फोटो एवं वीडियो गैलरी सेटअप होने के बाद यहाँ दिखाई देंगे।","Photos and videos will appear here once the gallery is configured."]
};
function langValue(value) { return Array.isArray(value) ? value[currentLanguage === "en" ? 1 : 0] : value; }
function setTextAll(selector, values) {
  const nodes = document.querySelectorAll(selector);
  nodes.forEach((node, i) => {
    const value = values[currentLanguage === "en" ? 1 : 0][i];
    if (value !== undefined) node.textContent = value;
  });
}
let galleryMessageType = "loading";
function setPageLanguage(language) {
  currentLanguage = language === "en" ? "en" : "hi";
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-lang-choice]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.langChoice === currentLanguage)));
  const navLinks = translations.nav[currentLanguage === "en" ? 1 : 0];
  nav?.querySelectorAll("a").forEach((node, i) => { if (navLinks[i]) node.textContent = navLinks[i]; });
  document.querySelector(".hero .eyebrow").textContent = langValue(translations.heroEyebrow);
  document.querySelector(".hero h1").innerHTML = langValue(translations.heroTitle);
  document.querySelector(".hero-content > p").textContent = langValue(translations.heroText);
  document.querySelectorAll(".hero .actions a").forEach((node, i) => node.textContent = translations.heroButtons[currentLanguage === "en" ? 1 : 0][i]);
  document.querySelector(".hero-ribbon").textContent = langValue(translations.ribbon);
  setTextAll(".quick-links strong", translations.quickStrong);
  setTextAll(".quick-links small", translations.quickSmall);
  setTextAll(".section-heading .eyebrow", translations.sectionEyebrows);
  setTextAll(".section-heading h2", translations.sectionTitles);
  setTextAll(".section-heading > p", translations.sectionTexts);
  setTextAll(".about-card h3", translations.aboutTitles);
  setTextAll(".about-card p", translations.aboutTexts);
  setTextAll(".class-tile strong", translations.classNames);
  document.querySelector(".admission-panel h3").textContent = langValue(translations.admissionTitle);
  document.querySelector(".admission-panel p").textContent = langValue(translations.admissionText);
  setTextAll(".admission-panel li", translations.admissionList);
  document.querySelector(".admission-panel .btn").textContent = langValue(translations.admissionButton);
  const notice = document.querySelector(".notice-empty h3");
  if (notice) notice.textContent = langValue(translations.noticeTitle);
  const noticeP = document.querySelector(".notice-empty p");
  if (noticeP) noticeP.textContent = langValue(translations.noticeText);
  const galleryAdmin = document.querySelector(".gallery-admin-link span");
  if (galleryAdmin) galleryAdmin.textContent = langValue(translations.galleryAdmin);
  const contactP = document.querySelector(".contact-panel > div > p");
  if (contactP) contactP.textContent = langValue(translations.contactAddress);
  const contactNote = document.querySelector(".contact-panel .muted");
  if (contactNote) contactNote.textContent = langValue(translations.contactNote);
  const mapButton = document.querySelector(".contact-panel .btn");
  if (mapButton) mapButton.textContent = langValue(translations.mapButton);
  const footerAddress = document.querySelector("footer p");
  if (footerAddress) footerAddress.textContent = langValue(translations.footerAddress);
  const menuButton = document.getElementById("menuToggle");
  if (menuButton) menuButton.setAttribute("aria-label", menuButton.getAttribute("aria-expanded") === "true" ? (currentLanguage === "en" ? "Close menu" : "मेनू बंद करें") : (currentLanguage === "en" ? "Open menu" : "मेनू खोलें"));
  const grid = document.getElementById("publicMediaGrid");
  if (grid && grid.querySelector(".gallery-message")) {\n    const messageKey = galleryMessageType === "empty" ? "galleryEmpty" : galleryMessageType === "error" ? "galleryError" : "galleryLoading";\n    grid.querySelector(".gallery-message").textContent = langValue(translations[messageKey]);\n  }
  try { localStorage.setItem("skd-language", currentLanguage); } catch {}
}
document.querySelectorAll("[data-lang-choice]").forEach((button) => button.addEventListener("click", () => setPageLanguage(button.dataset.langChoice)));

async function loadPublicGallery() {
  const grid = document.getElementById("publicMediaGrid");
  if (!grid) return;
  try {
    const response = await fetch("/api/media", { cache: "no-store" });
    if (!response.ok) throw new Error("gallery unavailable");
    const data = await response.json();
    grid.replaceChildren();
    if (!Array.isArray(data.items) || data.items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "gallery-message";
      empty.textContent = langValue(translations.galleryEmpty);
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
        media.alt = item.title || (currentLanguage === "en" ? "School activity" : "विद्यालय की गतिविधि");
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
    message.textContent = langValue(translations.galleryError);
    grid.appendChild(message);
  }
}
setPageLanguage(currentLanguage);
loadPublicGallery();