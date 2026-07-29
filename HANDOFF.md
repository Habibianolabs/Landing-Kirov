# Handoff для нового чата

Дата проверки: 29 июля 2026 года.

## Контекст

Каноническая рабочая папка frontend-проекта G10 для Кирова: `/Users/lilcheecha/Documents/Landings`.

Папка `/Users/lilcheecha/Documents/landing kirov` — файловая копия состояния от 25 июля 2026 года; её не использовать для дальнейшей разработки.

Production: https://g10-kirov.vercel.app/

Резервная копия GitHub: `git@github.com:Habibianolabs/Landing-Kirov.git`.
Основная ветка: `main`. Локальный `HEAD` и `origin/main` совпадают; точный SHA проверяется командой `git rev-parse HEAD`.
Последний production deployment Vercel проверен через CLI: статус `READY`, алиас `https://g10-kirov.vercel.app/`.

## Что прочитать в новом чате

1. `PROJECT_CONTEXT.md` — технический контекст и ограничения.
2. `CURRENT_TASK.md` — актуальный статус.
3. `CONTENT_MAP.md` — требования и контентная карта.
4. `IMPLEMENTATION_PLAN.md` — исходный план и этапы.
5. `TODO.md` — текущий roadmap.
6. `MISSING_MATERIALS.md` — открытые материалы и решения.
7. `MATERIALS_INDEX.md` — индекс исходников и production-assets.

## Состояние

Frontend реализован и опубликован. Backend намеренно не подключён. Форма пока выполняет клиентскую валидацию без отправки данных.

Последние frontend-изменения:

- блок «Культура гостеприимства» перерисован по предоставленному эскизу;
- карточки «Ключевые темы проекта», «Стоимость участия» и «Что входит в стоимость» получили холодные голубые web-аппроксимации liquid glass;
- в блоке «Что входит в стоимость» цифры заменены на символы `↗`, `◫`, `✦`, `⇢`;
- раскрытие тем проверено в Playwright на desktop и mobile.

Следующий безопасный шаг: прочитать перечисленные документы, подтвердить открытые контентные решения, затем отдельно спроектировать серверный endpoint формы и secrets/environment variables.

Backend остаётся на паузе. Production в Vercel синхронизирован с текущим frontend-состоянием.

Синхронизация проверена 29 июля 2026 года: рабочее дерево чистое, GitHub совпадает с локальным `HEAD`, `git fsck --full` не обнаружил повреждённых объектов, `node --check script.js` проходит, production отвечает `HTTP/2 200`. Контрольные хэши `index.html`, `styles.css`, `script.js` и 18 опубликованных assets совпадают с локальными файлами.

## Структура копии

В GitHub находятся 64 tracked-файла: HTML, CSS, JavaScript, assets, конфигурация и Markdown-документы. `.git`, `.playwright-cli`, `.vercel`, локальный `output`, `.DS_Store` и `.env.local` исключены как служебные или локальные файлы. Backend secrets в репозиторий не добавлялись.
