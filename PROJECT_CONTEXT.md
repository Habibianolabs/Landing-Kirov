# Проектный контекст

Дата обновления: 12 августа 2026 года.

## Назначение

Статический лендинг образовательного проекта «G10. Рестораторы и опердиры России. Перезагрузка» для города Киров. Даты мероприятия в текущем контенте: 5–7 октября 2026 года.

Production: [https://g10-kirov.vercel.app/](https://g10-kirov.vercel.app/)

## Техническая основа

[FACT] Это не Next.js, не React и не Vite. Vercel framework — `null`, build/install/dev-команды не заданы.

- `index.html` — семантическая разметка, секции, две формы, dialog-контейнеры и footer;
- `styles.css` — design tokens, статичный голубой фон, blue-glass surfaces, layout, responsive и motion states;
- `script.js` — навигация, active sections, disclosures, dialogs, lightbox, consent, форма и Vercel Analytics;
- `api/submit-application.js` — Vercel Function с серверной валидацией, honeypot, Upstash rate limiting, optional Turnstile и Resend;
- `.env.example` — контракт production environment variables;
- `assets/site/kirov/` — подключённые banner, логотипы, фотографии и event-assets;
- `assets/source-materials/` — канонический бриф;
- `vercel.json` — `cleanUrls: true`, `trailingSlash: false`;
- `package.json` — минимальные метаданные без runtime-зависимостей.

## Реализованный frontend

- sticky header, desktop/mobile navigation, skip-link, active section и CTA;
- статичный готовый баннер 1920×1080 без crop, DOM-наложений, вращения и бликов;
- blue-glass surfaces на всех основных секциях, фон страницы остаётся статичным;
- партнёры программы и шесть пунктов содержания программы;
- блок «О проекте» с актуальным текстом и каруселью из пяти фотографий; текущий кадр сохранён первым;
- блок «Как проходят наши мероприятия» с тремя предоставленными фотографиями, lightbox и сразу видимым Rutube iframe;
- секция «Партнёры проекта и их концепции»: две карточки компаний с dialogs и привязанными к ним группами концепций 6+3; у шести концепций «Культуры Гостеприимства» подключены графические иллюстрации из предоставленного референса, у трёх концепций «Маминой кухни» сохранены фотографии;
- в секции о компании подпись-кicker — «Ресторанный альянс «Культура гостеприимства»»; на desktop и mobile она переносится внутри рамки без горизонтального overflow;
- секция «Партнёры программы» возвращена к исходной композиции: стандартный фон секции, обычные внешние карточки и одинаковые внутренние рамки вокруг обоих логотипов с фоном `var(--surface-muted)`; названия секций оформлены увеличенными центрированными liquid-glass web-плашками;
- раскрывающийся список «Эксперты альянса» с 10 локальными миниатюрами портретов рядом с именами;
- placeholder программы на три дня без черновых строк `???`;
- блок «Эксперты» с сохранённым названием блока и без заголовка «Люди, которые строят систему изнутри»;
- в секциях после «Экспертов» до CTA сохранены только названия блоков без крупных H2; CTA-заголовок следующего блока сохранён;
- четыре группы ключевых тем, 14 пунктов и номера `1`–`4` внутри групп;
- тарифы, состав участия, галерея, lightbox, сразу открытый Rutube iframe, отзывы, cookie consent и footer;
- inline-форма и modal-форма с общей схемой отправки на `/api/submit-application`;
- событие аналитики `application_submitted` после успешного ответа API.

## Production-синхронизация

[FACT] 14 августа 2026 года локальная runtime-версия опубликована в Vercel deployment `dpl_AGSRivJHXqb7Sh6hoh36RFdYrZ5v` со статусом `READY`. Прямой deployment URL содержит актуальные section-heading-плашки и шесть графических иллюстраций концепций.

[FACT] `g10-kirov.vercel.app` редиректит на `g10.kirov.restoved.ru`; последний отвечает через `nginx/1.20.2` и пока отдаёт старый HTML. Это внешний origin, поэтому одной публикацией в Vercel его содержимое не обновить.

[FACT] Текущая ветка Git — `main`, remote — `git@github.com:Habibianolabs/Landing-Kirov.git`. В рабочем дереве есть незакоммиченные изменения frontend, production-assets и документации.

## Backend и ограничения production

Код backend готов локально и развернут как Vercel Function. Он включает:

- server-side нормализацию и валидацию;
- honeypot-поле `website`;
- Upstash rate limiting в production и memory fallback только вне production;
- optional server-side Cloudflare Turnstile;
- отправку заявок через Resend с `Reply-To` заявителя;
- 405 для неподдерживаемых методов и 429/503 для соответствующих ошибок.

[FACT] Production-приём заявок пока не активирован: в Vercel не подтверждены реальные Resend/Upstash credentials и не выполнена тестовая доставка. Адреса в `.env.example` — текущий fallback из материалов, а не подтверждённый заказчиком финальный routing.

Аналитика загружается только после analytics consent. Яндекс Метрика и Envybox не подключены.

## Открытые решения

- финальная программа 5–7 октября;
- лимит группы: 20 или 25;
- цена на 29 августа–4 сентября;
- 14 тем брифа или 13 тем пресс-релиза;
- отдельный портрет Михаила Скрябина для третьей большой карточки; портреты Андрея Несветаева и Владимира Шаклейна уже подключены;
- финальный список отзывов и разрешения;
- права на фотографии карусели, три предоставленные event-фото и Rutube;
- Resend sender/recipients и Upstash production env;
- Turnstile, Яндекс Метрика, Envybox и постоянный домен заказчика;
- финальный accessibility/performance/content audit.

## Источники

- канонический бриф: `assets/source-materials/Бриф для лендинга Киров.docx`;
- оригинал: `/Users/lilcheecha/Downloads/Telegram Desktop/Бриф для лендинга Киров(1).docx`;
- актуальная папка: `/Users/lilcheecha/Downloads/G10 Рестораторы России Киров 3`;
- GitHub: [Habibianolabs/Landing-Kirov](https://github.com/Habibianolabs/Landing-Kirov);
- функциональный референс: [g10-5.restoved.ru/ekaterinburg](https://g10-5.restoved.ru/ekaterinburg).

Екатеринбург используется только для структуры и поведения. Публичный контент проекта относится только к Кирову.
