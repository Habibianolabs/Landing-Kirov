# TODO — текущий roadmap G10 Киров

Дата обновления: 30 июля 2026 года.

Легенда: `[x]` выполнено, `[~]` частично или требует решения, `[ ]` не выполнено.

## 1. Анализ и подготовка

- [x] Прочитать бриф и локальные материалы.
- [x] Создать `CONTENT_MAP.md`, `MATERIALS_INDEX.md`, `IMPLEMENTATION_PLAN.md`, `MISSING_MATERIALS.md`.
- [x] Проверить структуру и поведение лендинга Екатеринбурга как функционального референса.
- [x] Проверить баннер, логотипы и фотографии.
- [x] Опубликовать текущий frontend в Vercel project `g10-kirov`.
- [~] Оформить первый Git commit и baseline; текущие файлы ещё не зафиксированы.
- [~] Сформировать отдельный manifest исходник → production asset → блок.

## 2. Материалы и контентные решения

- [x] Подключить готовый баннер без crop и DOM-наложений.
- [x] Подключить логотипы «Культура Гостеприимства», «Мамина кухня» и «Ресторанные ведомости».
- [x] Подключить фото «О проекте».
- [x] Подключить фото «Маминой кухни».
- [x] Скопировать четыре event-фото локально.
- [~] Подтвердить права на публикацию локальных event-фото и Rutube-материалов.
- [ ] Получить портреты трёх рестораторов или письменно подтвердить silhouette fallback.
- [ ] Получить финальную программу 5–7 октября или подтвердить placeholder до запуска.
- [ ] Утвердить лимит группы: 20 или 25.
- [ ] Утвердить цену на 29 августа–4 сентября и дополнительные условия.
- [ ] Утвердить финальный список тем: 14 пунктов брифа или 13 пунктов пресс-релиза.
- [ ] Утвердить список отзывов, длинную редакцию и разрешение на публикацию имён/видео.

## 3. Реализованный frontend

- [x] Sticky header, skip-link, якоря, active section и mobile menu.
- [x] Hero с готовым баннером 16:9 и отдельным CTA.
- [x] Партнёры программы.
- [x] Содержание программы из шести пунктов.
- [x] Блок «О проекте».
- [x] Партнёры проекта и подробные dialogs.
- [x] Placeholder программы и раскрытие трёх дней.
- [x] Карточки трёх рестораторов с честными placeholders портретов.
- [x] Четыре группы тем с 14 пунктами, текст виден сразу без раскрытия.
- [x] Тарифы, ценовые периоды и состав участия.
- [x] Галерея из четырёх фото и lightbox.
- [x] Отзывы и ссылка на видеоотзыв.
- [x] Inline-форма и modal-форма с client-side validation.
- [x] Cookie banner, настройки consent и footer.
- [x] Responsive CSS, scroll-reveal, hover/focus states, reduced-motion fallback.

## 4. Оставшийся frontend polish

- [x] Довести focus trap и restore focus для gallery/application/consent dialogs; partner dialog уже восстанавливает фокус.
- [~] Полностью пройти accessibility-аудит: keyboard-only, screen reader, labels/errors, contrast и 200% zoom.
- [~] Решить, нужен ли Rutube embed с poster; сейчас используется внешняя ссылка без autoplay.
- [ ] Выполнить responsive QA на 320×568, 360×800, 393×844, 768×1024, 1024×768, 1366×768, 1440×900 и 1920×1080.
- [ ] Подготовить responsive derivatives фотографий и проверить dimensions/aspect-ratio всех media.
- [ ] Проверить LCP, CLS, INP, lazy loading, cache headers и broken links.
- [x] Добавить событие `application_submitted` после успешной отправки формы.
- [ ] После получения Envybox config проверить safe area и конфликт с меню, формами и cookie UI.

## 5. Backend формы

- [x] Выбрать Resend как email provider и описать env-контракт.
- [ ] Добавить `RESEND_API_KEY`, verified sender и Upstash credentials в Vercel.
- [x] Подтвердить четыре адреса получателей из брифа и Reply-To заявки.
- [x] Создать server-side endpoint для inline и modal форм.
- [x] Добавить server validation, нормализацию, honeypot и server-side rate limiting; production требует Upstash credentials.
- [~] Подключить Cloudflare Turnstile при необходимости: server-side adapter готов, frontend widget пока не включён.
- [x] Реализовать success/error/loading states.
- [x] Не хранить credentials в HTML/CSS/JS; production secrets должны находиться только в Vercel Environment Variables.
- [ ] Провести staging smoke test и реальную тестовую заявку.
- [ ] Проверить доставку на четыре адреса.

## 6. Аналитика, cookies и Envybox

- [x] Создать frontend cookie banner с Accept/Reject/Settings.
- [~] Consent хранится локально; Vercel Analytics загружается только после analytics consent, остальные vendor scripts пока отсутствуют.
- [x] Подключить Vercel Analytics только после соответствующего consent.
- [ ] Проверить событие `application_submitted` в production.
- [ ] Получить Envybox code/config и подключить отложенно.
- [ ] Проверить mobile positioning и отсутствие перекрытий.

## 7. Финальная приёмка и релиз

- [ ] Зафиксировать content freeze по всем открытым решениям.
- [ ] Выполнить финальный accessibility/performance/content audit.
- [ ] Создать rollback point и первый Git commit.
- [x] Выполнить текущий production smoke test после визуальных правок.
- [ ] Настроить постоянный пользовательский домен, если нужен вместо Vercel alias.
