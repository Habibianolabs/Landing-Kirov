const body = document.body;
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const pendingNotice = document.querySelector(".pending-notice");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const menuBackground = document.querySelectorAll("main, .site-footer, [data-cookie-banner]");

function setMenuBackgroundInert(isInert) {
  menuBackground.forEach((element) => {
    element.inert = isInert;
    element.toggleAttribute("aria-hidden", isInert);
  });
}

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

function setupAboutCarousel() {
  const carousel = document.querySelector("[data-about-carousel]");
  if (!carousel) return;

  const viewport = carousel.querySelector(".about-carousel__viewport");
  const track = carousel.querySelector(".about-carousel__track");
  const slides = [...carousel.querySelectorAll("[data-about-slide]")];
  const dots = [...carousel.querySelectorAll("[data-about-dot]")];
  const counter = carousel.querySelector("[data-about-counter]");
  const previousButton = carousel.querySelector("[data-about-prev]");
  const nextButton = carousel.querySelector("[data-about-next]");
  if (!viewport || !track || !slides.length) return;

  let currentIndex = 0;
  let pointerStartX = null;

  function renderAboutSlide(nextIndex) {
    currentIndex = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translate3d(${-currentIndex * 100}%, 0, 0)`;
    slides.forEach((slide, index) => {
      const isCurrent = index === currentIndex;
      slide.classList.toggle("is-active", isCurrent);
      slide.setAttribute("aria-hidden", String(!isCurrent));
    });
    dots.forEach((dot, index) => {
      const isCurrent = index === currentIndex;
      dot.classList.toggle("is-active", isCurrent);
      if (isCurrent) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (counter) counter.textContent = `${currentIndex + 1} / ${slides.length}`;
  }

  previousButton?.addEventListener("click", () => renderAboutSlide(currentIndex - 1));
  nextButton?.addEventListener("click", () => renderAboutSlide(currentIndex + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => renderAboutSlide(index)));

  viewport.addEventListener("pointerdown", (event) => {
    pointerStartX = event.clientX;
  });
  viewport.addEventListener("pointerup", (event) => {
    if (pointerStartX === null) return;
    const distance = event.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(distance) < 40) return;
    renderAboutSlide(currentIndex + (distance < 0 ? 1 : -1));
  });
  viewport.addEventListener("pointercancel", () => { pointerStartX = null; });

  renderAboutSlide(0);
}

setupAboutCarousel();

function closeMenu({ restoreFocus = false } = {}) {
  if (!menuToggle || !siteNav) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Открыть меню");
  siteNav.classList.remove("is-open");
  body.classList.remove("menu-open");
  setMenuBackgroundInert(false);
  if (restoreFocus) menuToggle.focus();
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Открыть меню" : "Закрыть меню");
  siteNav?.classList.toggle("is-open", !isOpen);
  body.classList.toggle("menu-open", !isOpen);
  setMenuBackgroundInert(!isOpen);
  if (!isOpen) siteNav?.querySelector("a")?.focus();
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

function loadVercelAnalytics() {
  if (document.querySelector("script[data-vercel-analytics]")) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/insights/script.js";
  script.dataset.vercelAnalytics = "true";
  document.head.appendChild(script);
}

const yandexMetrikaId = 111727875;
let yandexMetrikaEnabled = false;

function loadYandexMetrika() {
  if (document.querySelector("script[data-yandex-metrika]")) return;
  window.ym = window.ym || function yandexMetrikaQueue() {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = Date.now();
  window.ym(yandexMetrikaId, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${yandexMetrikaId}`;
  script.dataset.yandexMetrika = "true";
  document.head.appendChild(script);
  yandexMetrikaEnabled = true;
}

function trackEvent(name, data = {}) {
  if (typeof window.va === "function") window.va("event", { name, ...data });
  if (yandexMetrikaEnabled && typeof window.ym === "function") window.ym(yandexMetrikaId, "reachGoal", name, data);
}

document.querySelectorAll("[data-open-application]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    trackEvent("application_open", {
      plan: trigger.dataset.plan || "not_selected",
      source: trigger.dataset.ctaSource || "unknown"
    });
    if (trigger.dataset.plan) trackEvent("tariff_selected", { plan: trigger.dataset.plan });
  });
});

document.querySelectorAll("a[href^='tel:']").forEach((link) => {
  link.addEventListener("click", () => trackEvent("phone_click", { location: "footer" }));
});

document.querySelectorAll(".logo-link[href]").forEach((link) => {
  link.addEventListener("click", () => trackEvent("partner_site_open", { partner: link.getAttribute("aria-label") || "unknown" }));
});

const trackedScrollDepths = new Set();
function trackScrollDepth() {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollableHeight <= 0) return;
  const depth = ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100;
  [50, 90].forEach((threshold) => {
    if (depth >= threshold && !trackedScrollDepths.has(threshold)) {
      trackedScrollDepths.add(threshold);
      trackEvent(`scroll_${threshold}`);
    }
  });
}
window.addEventListener("scroll", trackScrollDepth, { passive: true });

function hasAnalyticsConsent() {
  try {
    const consent = localStorage.getItem(consentStorageKey);
    return consent === "all" || consent === "analytics";
  } catch (error) { return false; }
}

document.querySelectorAll("[data-application-form]").forEach((form, index) => {
  const status = form.querySelector("[data-form-status]");
  const errorId = `application-form-errors-${index + 1}`;
  if (status) status.id = errorId;

  const fields = [...form.querySelectorAll("input:not([type='hidden'])")];
  fields.forEach((field) => field.setAttribute("aria-describedby", errorId));

  function showFormStatus(message, { isError = false } = {}) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
    status.setAttribute("role", isError ? "alert" : "status");
    status.setAttribute("aria-live", isError ? "assertive" : "polite");
  }

  function clearFieldErrors() {
    fields.forEach((field) => field.removeAttribute("aria-invalid"));
  }

  fields.forEach((field) => field.addEventListener("input", () => {
    field.removeAttribute("aria-invalid");
  }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFieldErrors();
    if (!form.checkValidity()) {
      const invalidFields = fields.filter((field) => !field.validity.valid);
      invalidFields.forEach((field) => field.setAttribute("aria-invalid", "true"));
      const firstInvalid = invalidFields[0];
      const fieldNames = invalidFields.map((field) => (field.closest("label")?.innerText?.trim().replace(/\s+/g, " ") || "поле").replace(/[.。]+$/, ""));
      showFormStatus(`Проверьте поля: ${fieldNames.join(", ")}.`, { isError: true });
      firstInvalid?.focus();
      return;
    }
    const submitButton = form.querySelector("[type='submit']");
    const formData = Object.fromEntries(new FormData(form).entries());
    if (submitButton) submitButton.disabled = true;
    showFormStatus("Отправляем заявку…");

    try {
      const response = await fetch("/api/submit-application", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(formData)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Не удалось отправить заявку.");
      showFormStatus("Заявка отправлена. Мы свяжемся с вами в ближайшее время.");
      trackEvent("application_submitted", { plan: formData.plan || "not_selected", source: formData.source || "unknown" });
      form.reset();
    } catch (error) {
      showFormStatus(error.message || "Не удалось отправить заявку. Попробуйте ещё раз.", { isError: true });
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

const galleryDialog = document.getElementById("galleryDialog");
const galleryImage = galleryDialog?.querySelector("[data-gallery-image]");
const galleryCaption = galleryDialog?.querySelector("[data-gallery-caption]");
const galleryItems = [...document.querySelectorAll("[data-gallery-item]")];
let galleryIndex = 0;
let lastGalleryTrigger = null;
function renderGalleryImage(index) {
  if (!galleryImage || !galleryItems.length) return;
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  galleryImage.src = item.dataset.gallerySrc;
  galleryImage.alt = item.dataset.galleryAlt || "";
  if (galleryCaption) galleryCaption.textContent = item.dataset.galleryAlt || "";
}
function closeGalleryDialog() {
  closeDialog(galleryDialog);
  lastGalleryTrigger?.focus();
  lastGalleryTrigger = null;
}
galleryItems.forEach((item, index) => item.addEventListener("click", () => {
  lastGalleryTrigger = item;
  renderGalleryImage(index);
  showDialog(galleryDialog);
}));
document.querySelector("[data-gallery-prev]")?.addEventListener("click", () => renderGalleryImage(galleryIndex - 1));
document.querySelector("[data-gallery-next]")?.addEventListener("click", () => renderGalleryImage(galleryIndex + 1));
document.querySelector("[data-close-gallery]")?.addEventListener("click", closeGalleryDialog);
galleryDialog?.addEventListener("click", (event) => { if (event.target === galleryDialog) closeGalleryDialog(); });
galleryDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeGalleryDialog(); });

const consentDialog = document.getElementById("consentDialog");
const cookieBanner = document.querySelector("[data-cookie-banner]");
const consentStorageKey = "g10-kirov-consent-v1";
let lastConsentTrigger = null;
function setConsent(value) {
  let savedValue = value;
  if (value === "custom") {
    const analyticsEnabled = consentDialog?.querySelector("[name='analytics-cookies']")?.checked;
    savedValue = analyticsEnabled ? "analytics" : "necessary";
  }
  try { localStorage.setItem(consentStorageKey, savedValue); } catch (error) { /* private browsing can block storage */ }
  if (savedValue === "all" || savedValue === "analytics") {
    loadVercelAnalytics();
    loadYandexMetrika();
    trackScrollDepth();
  }
  if (cookieBanner) cookieBanner.hidden = true;
  closeConsentDialog();
}
function openConsentSettings(event) {
  lastConsentTrigger = event?.currentTarget || document.activeElement;
  showDialog(consentDialog);
}
function closeConsentDialog() {
  closeDialog(consentDialog);
  lastConsentTrigger?.focus();
  lastConsentTrigger = null;
}
try { if (!localStorage.getItem(consentStorageKey) && cookieBanner) cookieBanner.hidden = false; } catch (error) { if (cookieBanner) cookieBanner.hidden = false; }
if (hasAnalyticsConsent()) {
  loadVercelAnalytics();
  loadYandexMetrika();
  trackScrollDepth();
}
document.querySelector("[data-cookie-accept]")?.addEventListener("click", () => setConsent("all"));
document.querySelector("[data-cookie-reject]")?.addEventListener("click", () => setConsent("necessary"));
document.querySelector("[data-cookie-settings]")?.addEventListener("click", openConsentSettings);
document.querySelector("[data-open-consent]")?.addEventListener("click", openConsentSettings);
document.querySelector("[data-close-consent]")?.addEventListener("click", closeConsentDialog);
document.querySelector("[data-save-consent]")?.addEventListener("click", () => setConsent("custom"));
consentDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeConsentDialog(); });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteNav?.classList.contains("is-open")) closeMenu({ restoreFocus: true });
  if (event.key === "Tab" && siteNav?.classList.contains("is-open") && menuToggle) {
    const menuFocusables = [menuToggle, ...siteNav.querySelectorAll("a[href]")];
    const currentIndex = menuFocusables.indexOf(document.activeElement);
    if (currentIndex === -1) return;
    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + menuFocusables.length) % menuFocusables.length
      : (currentIndex + 1) % menuFocusables.length;
    event.preventDefault();
    menuFocusables[nextIndex].focus();
  }
  if (event.key === "ArrowLeft" && galleryDialog?.open) renderGalleryImage(galleryIndex - 1);
  if (event.key === "ArrowRight" && galleryDialog?.open) renderGalleryImage(galleryIndex + 1);
});
