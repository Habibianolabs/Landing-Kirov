# Handoff для нового чата

Дата: 25 июля 2026 года.

## Контекст

Каноническая рабочая папка frontend-проекта G10 для Кирова: `/Users/lilcheecha/Documents/Landings`.

Папка `/Users/lilcheecha/Documents/landing kirov` — файловая копия состояния от 25 июля 2026 года; её не использовать для дальнейшей разработки.

Production: https://g10-kirov.vercel.app/

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

Следующий безопасный шаг: прочитать перечисленные документы, подтвердить открытые контентные решения, затем отдельно спроектировать серверный endpoint формы и secrets/environment variables.

## Структура копии

В файловую копию были перенесены HTML, CSS, JavaScript, assets, конфигурация и Markdown-документы. `.git`, `.playwright-cli`, `.vercel` и локальный `output` туда не переносились как временные/служебные каталоги.
