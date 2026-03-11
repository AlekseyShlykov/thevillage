# Сбор email на экране «Конец демо»

На экране «Конец демо» игрок может оставить email. Чтобы сохранять адреса в Google Таблицу:

1. **Создайте Google Таблицу** (Google Sheets): например `Winter Village — Emails`.

2. **Добавьте скрипт**:
   - В таблице: Расширения → Apps Script.
   - Удалите содержимое и вставьте:

```javascript
function doPost(e) {
  try {
    const data = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const email = data.email || '';
    if (!email) return ContentService.createTextOutput(JSON.stringify({ ok: false })).setMimeType(ContentService.MimeType.JSON);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.appendRow([new Date().toISOString(), email]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. **Разверните как веб‑приложение**:
   - Выполнить → Развернуть → Новое развёртывание → Тип: Веб‑приложение.
   - «У кого есть доступ»: Все (если игра на itch.io/GitHub Pages).
   - Скопируйте URL веб‑приложения.

4. **Укажите URL в конфиге**:
   - В `public/data/game-balance.json` в блоке `demoEnd` задайте `emailSubmitUrl`: вставьте скопированный URL.

Игра отправляет на этот URL POST с телом `{ "email": "user@example.com" }`. Скрипт добавляет в таблицу строку: дата/время и email.

Если `emailSubmitUrl` пустой, форма всё равно показывается; при нажатии «Отправить» отображается только «Спасибо!» без запроса в интернет.
