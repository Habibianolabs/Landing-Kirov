const body = document.body;
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const pendingNotice = document.querySelector(".pending-notice");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setupScrollReveal() {
  if (prefersReducedMotion) return;
  document.documentElement.classList.add("has-motion");

  const revealGroups = [
    { selector: ".hero", direction: "up" },
    { selector: ".section-heading", direction: "up" },
    { selector: ".logo-card", direction: "up", stagger: 90 },
    { selector: ".benefit-card", direction: "up", stagger: 70 },
    { selector: ".culture-story, .about-copy", direction: "left" },
    { selector: ".about-visual", direction: "right" },
    { selector: ".project-partner-card, .concept-card, .person-card, .price-card, .included-card, .testimonial-card", direction: "up", stagger: 70 },
    { selector: ".schedule-placeholder, .schedule-day, .topic-group, .gallery-item", direction: "up", stagger: 60 },
    { selector: ".inline-cta, .video-placeholder, .video-testimonial, .application-layout, .completion-note", direction: "up" }
  ];

  const targets = [];
  revealGroups.forEach(({ selector, direction, stagger = 0 }) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.dataset.reveal = direction;
      element.style.setProperty("--reveal-delay", `${index * stagger}ms`);
      targets.push(element);
    });
  });

  if (!("IntersectionObserver" in window)) {
    targets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

  targets.forEach((element) => revealObserver.observe(element));
}

setupScrollReveal();

function closeMenu() {
  if (!menuToggle || !siteNav) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Открыть меню");
  siteNav.classList.remove("is-open");
  body.classList.remove("menu-open");
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Открыть меню" : "Закрыть меню");
  siteNav?.classList.toggle("is-open", !isOpen);
  body.classList.toggle("menu-open", !isOpen);
});

function showPendingNotice(message = "Этот блок будет добавлен после получения подтверждённых материалов.") {
  if (!pendingNotice) return;
  pendingNotice.textContent = message;
  pendingNotice.hidden = false;
  window.clearTimeout(showPendingNotice.timeout);
  showPendingNotice.timeout = window.setTimeout(() => { pendingNotice.hidden = true; }, 4200);
}

document.querySelectorAll("[data-pending]").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    showPendingNotice();
  });
});

document.querySelectorAll(".site-nav a[href^='#']").forEach((link) => {
  link.addEventListener("click", () => closeMenu());
});

const sectionLinks = [...document.querySelectorAll("[data-nav-section]")];
const observedSections = sectionLinks.map((link) => document.getElementById(link.dataset.navSection)).filter(Boolean);
if ("IntersectionObserver" in window && observedSections.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = sectionLinks.find((item) => item.dataset.navSection === entry.target.id);
      link?.classList.toggle("is-active", entry.isIntersecting);
    });
  }, { rootMargin: "-30% 0px -58% 0px", threshold: 0 });
  observedSections.forEach((section) => sectionObserver.observe(section));
}

function showDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  body.classList.add("dialog-open");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  body.classList.remove("dialog-open");
}

const partnerDialog = document.getElementById("partnerDialog");
const partnerDialogTitle = document.getElementById("partner-dialog-title");
const partnerDialogKicker = document.getElementById("partner-dialog-kicker");
const partnerDialogContent = document.getElementById("partner-dialog-content");
let lastDialogTrigger = null;

const partnerData = {
  culture: {
    kicker: "Культура Гостеприимства",
    title: "Ресторанный альянс",
    html: `<h3>Описание компании</h3><p>Одна из самых современных ресторанных компаний России с сильным операционным управлением и уникальным опытом масштабирования за пределы региона. Сегодня под управлением альянса — 21 кафе и ресторан в пяти городах России: Кирове, Москве, Нижнем Новгороде, Сыктывкаре и Чебоксарах. В команде более 700 профессионалов. Выручка ресторанов альянса составляет порядка 1,5 млрд рублей.</p><h3>Ключевые проекты</h3><p>В портфель компании входят грузинский ресторан «Сулугуни», восточный ресторан «Куркума», ресторан средиземноморской кухни Si, mare, кафе «Сушилка» и кофейня «Искра», а также «Дача», «Джари», «Вкусноблин», бар-музей «Васи Ложкина», «Чико» в Нижнем Новгороде и другие проекты.</p><h3>Развитие и достижения</h3><p>Альянс «Культура Гостеприимства» — одна из первых ресторанных компаний в России, которая начала внедрять передовые технологические решения, автоматизировать бизнес-процессы и использовать искусственный интеллект в управлении. Компания признана «Открытием года» по версии Информационной группы «Ресторанные ведомости».</p>`
  },
  mamina: {
    kicker: "Мамина кухня",
    title: "Ресторанная группа",
    html: `<h3>Описание компании</h3><p>Ресторанная группа, совмещающая сеть заведений демократичного формата и ресторацию с исторической концепцией «Царское село».</p><h3>Ключевые проекты</h3><p>В портфель ресторанной группы входят кулинарии и кафе «Мамина кухня» в разных районах Кирова, трактир «Колесо», «Реберная. Еда на огне», бистро «Вареничная» и ресторация «Царское село» — изысканный ресторан русской кухни, расположенный в историческом здании 1902 года.</p><h3>Развитие и достижения</h3><p>Ресторация «Царское село» входит в число самых обсуждаемых ресторанов Кирова и считается «визитной карточкой города».</p>`
  }
};

function restorePartnerFocus() {
  lastDialogTrigger?.focus();
  lastDialogTrigger = null;
}

document.querySelectorAll("[data-open-partner]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const data = partnerData[trigger.dataset.openPartner];
    if (!data || !partnerDialog) return;
    lastDialogTrigger = trigger;
    partnerDialogKicker.textContent = data.kicker;
    partnerDialogTitle.textContent = data.title;
    partnerDialogContent.innerHTML = data.html;
    showDialog(partnerDialog);
  });
});

document.querySelector("[data-close-partner]")?.addEventListener("click", () => { closeDialog(partnerDialog); restorePartnerFocus(); });
partnerDialog?.addEventListener("click", (event) => { if (event.target === partnerDialog) { closeDialog(partnerDialog); restorePartnerFocus(); } });
partnerDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(partnerDialog); restorePartnerFocus(); });

document.querySelectorAll("[data-disclosure-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    const expanded = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;
  });
});

const applicationDialog = document.getElementById("applicationDialog");
let lastApplicationTrigger = null;
document.querySelectorAll("[data-open-application]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    closeMenu();
    lastApplicationTrigger = trigger;
    const plan = trigger.dataset.plan || "";
    applicationDialog?.querySelectorAll("input[name='plan']").forEach((field) => { field.value = plan; });
    showDialog(applicationDialog);
  });
});

function closeApplicationDialog() {
  closeDialog(applicationDialog);
  lastApplicationTrigger?.focus();
  lastApplicationTrigger = null;
}
document.querySelector("[data-close-application]")?.addEventListener("click", closeApplicationDialog);
applicationDialog?.addEventListener("click", (event) => { if (event.target === applicationDialog) closeApplicationDialog(); });
applicationDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeApplicationDialog(); });

document.querySelectorAll("[data-application-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-form-status]");
    if (!form.checkValidity()) {
      form.reportValidity();
      if (status) { status.textContent = "Проверьте обязательные поля и согласие."; status.classList.add("is-error"); }
      return;
    }
    if (status) { status.textContent = "Frontend-форма проверена. Отправка будет подключена после добавления backend."; status.classList.remove("is-error"); }
  });
});

const galleryDialog = document.getElementById("galleryDialog");
const galleryImage = galleryDialog?.querySelector("[data-gallery-image]");
const galleryCaption = galleryDialog?.querySelector("[data-gallery-caption]");
const galleryItems = [...document.querySelectorAll("[data-gallery-item]")];
let galleryIndex = 0;
function renderGalleryImage(index) {
  if (!galleryImage || !galleryItems.length) return;
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  galleryImage.src = item.dataset.gallerySrc;
  galleryImage.alt = item.dataset.galleryAlt || "";
  if (galleryCaption) galleryCaption.textContent = item.dataset.galleryAlt || "";
}
galleryItems.forEach((item, index) => item.addEventListener("click", () => { renderGalleryImage(index); showDialog(galleryDialog); }));
document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => renderGalleryImage(galleryIndex - 1));
document.querySelector("[data-gallery-next]")?.addEventListener("click", () => renderGalleryImage(galleryIndex + 1));
document.querySelector("[data-close-gallery]")?.addEventListener("click", () => closeDialog(galleryDialog));
galleryDialog?.addEventListener("click", (event) => { if (event.target === galleryDialog) closeDialog(galleryDialog); });
galleryDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(galleryDialog); });

const consentDialog = document.getElementById("consentDialog");
const cookieBanner = document.querySelector("[data-cookie-banner]");
const consentStorageKey = "g10-kirov-consent-v1";
function setConsent(value) {
  try { localStorage.setItem(consentStorageKey, value); } catch (error) { /* private browsing can block storage */ }
  if (cookieBanner) cookieBanner.hidden = true;
  closeDialog(consentDialog);
}
function openConsentSettings() { showDialog(consentDialog); }
try { if (!localStorage.getItem(consentStorageKey) && cookieBanner) cookieBanner.hidden = false; } catch (error) { if (cookieBanner) cookieBanner.hidden = false; }
document.querySelector("[data-cookie-accept]")?.addEventListener("click", () => setConsent("all"));
document.querySelector("[data-cookie-reject]")?.addEventListener("click", () => setConsent("necessary"));
document.querySelector("[data-cookie-settings]")?.addEventListener("click", openConsentSettings);
document.querySelector("[data-open-consent]")?.addEventListener("click", openConsentSettings);
document.querySelector("[data-close-consent]")?.addEventListener("click", () => closeDialog(consentDialog));
document.querySelector("[data-save-consent]")?.addEventListener("click", () => setConsent("custom"));
consentDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(consentDialog); });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteNav?.classList.contains("is-open")) closeMenu();
  if (event.key === "ArrowLeft" && galleryDialog?.open) renderGalleryImage(galleryIndex - 1);
  if (event.key === "ArrowRight" && galleryDialog?.open) renderGalleryImage(galleryIndex + 1);
});
