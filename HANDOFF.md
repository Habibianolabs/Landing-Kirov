# Handoff для нового чата

Дата проверки: 30 июля 2026 года.

## Канонический проект

- Рабочая папка: `/Users/lilcheecha/Documents/Landings`
- Проект: G10 «Рестораторы и опердиры России. Перезагрузка» для города Киров
- GitHub: https://github.com/Habibianolabs/Landing-Kirov
- Git remote: `git@github.com:Habibianolabs/Landing-Kirov.git`
- Ветка: `main`
- Vercel project: `g10-kirov`
- Production: https://g10-kirov.vercel.app/
- Функциональный референс структуры: https://g10-5.restoved.ru/ekaterinburg

Екатеринбург используется только как небольшой функциональный референс расположения блоков и поведения. Его визуальную айдентику, контент и материалы переносить нельзя. Проект делается только для Кирова; другие города к нему не относятся и не должны появляться в коде, контенте, названиях файлов или документации.

## Источники и материалы

- Канонический бриф в репозитории: `assets/source-materials/Бриф для лендинга Киров.docx`
- Оригинальный файл брифа: `/Users/lilcheecha/Downloads/Telegram Desktop/Бриф для лендинга Киров(1).docx`
- Полная актуальная папка исходников: `/Users/lilcheecha/Downloads/G10 Рестораторы России Киров 3`
- Production-assets: `assets/site/kirov/`
- Индекс материалов: `MATERIALS_INDEX.md`
- Открытые контентные вопросы: `MISSING_MATERIALS.md`

При конфликте источников приоритет у брифа, затем у актуальной папки материалов. Черновое расписание с `???`, неподтвержденные портреты и неподтвержденные цены нельзя выдавать за финальные данные.

## Что прочитать в новом чате

1. `PROJECT_CONTEXT.md` — технический контекст и ограничения.
2. `CURRENT_TASK.md` — текущий статус и ближайшие действия.
3. `CONTENT_MAP.md` — карта требований и контента.
4. `MATERIALS_INDEX.md` — источники и подключенные assets.
5. `MISSING_MATERIALS.md` — незакрытые материалы и решения.
6. `IMPLEMENTATION_PLAN.md` — план и история этапов.
7. `TODO.md` — checklist.
8. `NEW_CHAT_CONTEXT.md` — готовое сообщение для передачи в новый чат.

## Текущее состояние

Frontend — статический HTML/CSS/JavaScript без Next.js и без сборщика:

- `index.html` — разметка, секции и две формы;
- `styles.css` — визуальная система и responsive;
- `script.js` — навигация, dialogs, disclosures, lightbox, consent, отправка формы и Vercel Analytics;
- `api/submit-application.js` — Vercel Function формы;
- `.env.example` — список production environment variables.

Frontend опубликован. Локально добавлен backend формы: server-side validation, honeypot, rate limiting, optional Cloudflare Turnstile, Resend adapter, Reply-To и обработка success/error/loading. Production-отправка пока не считается включенной: в Vercel ещё нужно добавить реальные переменные и выполнить deploy/smoke test.

## Backend: что осталось

1. В Resend создать API key и подтвердить домен/адрес отправителя.
2. В Upstash создать Redis и получить REST URL/token.
3. Добавить переменные из `.env.example` в Vercel Project Settings → Environment Variables.
4. Выполнить production deploy и проверить rate limiting, honeypot и доставку тестовой заявки на четыре адреса.
5. При необходимости подключить Cloudflare Turnstile: нужны site key для frontend и `TURNSTILE_SECRET_KEY` для backend; сейчас серверная проверка уже поддержана, но widget в HTML не включен.
6. Проверить событие `application_submitted` в production после analytics consent.

Получатели по умолчанию: `lp@restoranoff.ru`, `rv@restoranoff.ru`, `event@restoranoff.ru`, `p.spiridonova@restoranoff.ru`. Секреты в Git и в клиентский код не добавлять.

## Контент, который ещё требует решения

- финальная программа 5–7 октября;
- лимит группы: 20 или 25 участников;
- цена на период 29 августа–4 сентября;
- выбор 14 тем брифа или 13 тем пресс-релиза;
- официальные портреты трёх рестораторов или подтверждение силуэтов;
- финальные отзывы и разрешение на публикацию;
- права на локальные event-фото и Rutube-материал;
- код и правила показа Envybox;
- постоянный домен, если нужен вместо Vercel alias.

## Проверки

Последние локальные проверки: `node --check script.js`, `node --check api/submit-application.js`, `git diff --check`, проверка локальных ссылок и дубликатов assets — пройдены. Локально в Playwright проверены возврат фокуса из gallery/cookies, ошибки формы и tab-cycle мобильного меню на 390 px. В рабочем дереве есть незакоммиченные изменения; первый commit ещё не создан.

Не выполнять destructive Git-команды и не переписывать историю без отдельного указания.
