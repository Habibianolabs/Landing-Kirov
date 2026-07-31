# Сообщение для нового чата

Скопируй в новый чат весь текст ниже.

```text
Продолжаем проект лендинга G10 «Рестораторы и опердиры России. Перезагрузка» только для города Киров.

Корень проекта:
/Users/lilcheecha/Documents/Landings

Главный источник:
/Users/lilcheecha/Documents/Landings/assets/source-materials/Бриф для лендинга Киров.docx

Оригинальный бриф:
/Users/lilcheecha/Downloads/Telegram Desktop/Бриф для лендинга Киров(1).docx

Актуальная папка с исходными фотографиями, логотипами и документами:
/Users/lilcheecha/Downloads/G10 Рестораторы России Киров 3

Папка подключенных production-assets:
/Users/lilcheecha/Documents/Landings/assets/site/kirov

Сначала прочитай в корне проекта:
- PROJECT_CONTEXT.md
- CURRENT_TASK.md
- CONTENT_MAP.md
- MATERIALS_INDEX.md
- MISSING_MATERIALS.md
- IMPLEMENTATION_PLAN.md
- TODO.md
- HANDOFF.md

Ссылки:
- GitHub: https://github.com/Habibianolabs/Landing-Kirov
- Vercel production: https://g10-kirov.vercel.app/
- Vercel project: g10-kirov
- Функциональный референс структуры: https://g10-5.restoved.ru/ekaterinburg

Екатеринбург — только небольшой референс по расположению блоков и поведению. Не копируй его визуальный стиль, контент или материалы. Используй только кировские данные; другие города не относятся к проекту и не должны появляться в файлах.

Техническая основа:
- статический index.html + styles.css + script.js;
- Vercel Function: api/submit-application.js;
- env-контракт: .env.example;
- backend уже содержит server validation, honeypot, rate limiting, optional Turnstile и отправку через Resend;
- production backend ещё не активирован: нужны Resend API key/from email, Upstash REST URL/token, Vercel env и deploy/smoke test;
- событие аналитики после успешной заявки: application_submitted.

Не клади секреты в Git или frontend. При конфликте данных приоритет у брифа, затем у актуальной папки исходников. Не публикуй черновое расписание с ???, неподтвержденные портреты и неподтвержденные цены. Не выполняй destructive Git-команды и не переписывай историю.

Открытые решения: финальная программа 5–7 октября, лимит 20/25 участников, цена 29 августа–4 сентября, список 14/13 тем, портреты рестораторов, финальные отзывы и разрешения, права на event-фото/Rutube, Envybox и постоянный домен.
```
