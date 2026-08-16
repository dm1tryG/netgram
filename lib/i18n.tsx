"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "ru" | "en";

export const LOCALE_STORAGE_KEY = "netgram_locale";
const STORAGE_KEY = LOCALE_STORAGE_KEY;

const DICT: Record<Locale, Record<string, string>> = {
  ru: {
    "nav.permissions": "Разрешения",
    "nav.drafts": "Черновики",
    "nav.connect": "Подключить MCP",
    "user.loading": "Загрузка...",
    "lang.label": "Язык",

    "connect.title": "Подключить MCP",
    "connect.desc":
      "NetGram сам отдаёт MCP-сервер по HTTP. Добавь его в Claude Code, Claude Desktop или Cursor — ставить ничего не нужно.",
    "connect.cli": "Claude Code (терминал)",
    "connect.json": "Claude Desktop / Cursor — файл конфига",
    "connect.copy": "Скопировать",
    "connect.copied": "Скопировано",
    "connect.noToken":
      "Токен не задан — порт открыт без авторизации. Так бывает в dev или Docker; в приложении для Mac токен есть всегда.",
    "connect.tools": "Что получает агент",
    "connect.safety":
      "Через MCP нельзя выдать себе доступ или подтвердить черновик — это только вручную здесь. Отправка сразу происходит лишь в чатах с уровнем «Полный».",

    "permissions.title": "Разрешения",
    "permissions.desc":
      "Чтение — AI видит сообщения. Запись — AI предлагает черновики (подтверждаешь вручную). Полный — AI действует сам, без подтверждения.",
    "permissions.search": "Поиск по названию чата или канала...",
    "permissions.refresh": "↻ Обновить",
    "permissions.refreshing": "Обновляю…",
    "filter.all": "Все типы",
    "filter.user": "Люди",
    "filter.bot": "Боты",
    "filter.group": "Группы",
    "filter.channel": "Каналы",
    "sidebar.collapse": "Свернуть панель",
    "sidebar.expand": "Развернуть панель",
    "permissions.empty": "Ничего не найдено.",
    "permissions.loading": "Загружаю чаты...",
    "permissions.error": "Не удалось загрузить чаты",

    "level.read": "Чтение",
    "level.write": "Запись",
    "level.full": "Полный",
    "level.read.tip": "AI может читать сообщения этого чата.",
    "level.write.tip":
      "AI предлагает сообщения и клики по кнопкам — ты подтверждаешь их вручную в разделе «Черновики».",
    "level.full.tip":
      "Полный доступ: AI действует сам, без подтверждения — отправляет и кликает сразу. Используй осторожно.",

    "drafts.title": "Черновики",
    "drafts.desc":
      "Действия, предложенные AI: сообщения и клики по кнопкам. Выполняются в Telegram только отсюда — вручную.",
    "drafts.empty.pre": "Черновиков нет. AI создаёт их через",
    "drafts.empty.or": "или",
    "drafts.loading": "Загружаю черновики...",
    "drafts.error": "Не удалось загрузить черновики",

    "draft.kind.message": "сообщение",
    "draft.kind.click": "клик · msg #",
    "draft.badge.done": "Готово",
    "draft.badge.click": "Клик",
    "draft.badge.draft": "Черновик",
    "draft.pressButton": "Нажать кнопку",
    "draft.botAnswer": "Ответ бота:",
    "draft.confirm.send": "Отправить в Telegram?",
    "draft.confirm.click": "Нажать кнопку в Telegram?",
    "draft.confirm.irreversible": "Действие необратимо.",

    "btn.send": "Отправить",
    "btn.press": "Нажать",
    "btn.delete": "Удалить",
    "btn.cancel": "Отмена",
    "btn.confirm": "Да, выполнить",
    "btn.sending": "Отправляю...",
    "btn.clicking": "Кликаю...",

    "err.chat_not_writable": "Чат больше не разрешён на запись — действие запрещено.",
    "err.already_sent": "Уже выполнено.",
    "err.draft_not_found": "Черновик не найден.",
    "err.invalid_click_draft": "Клик-черновик повреждён.",
    "err.default": "Не удалось выполнить.",

    "setup.title": "NetGram — настройка",
    "setup.desc":
      "NetGram работает с твоим собственным Telegram-приложением. Это одноразовый шаг — данные сохранятся локально.",
    "setup.step1.pre": "1. Открой",
    "setup.step1.post": "и войди.",
    "setup.step2": "2. Create application (любые название/платформа).",
    "setup.step3.pre": "3. Скопируй оттуда",
    "setup.step3.post": "→ вставь ниже.",
    "setup.phone": "Телефон (с кодом страны)",
    "setup.saving": "Сохраняю...",
    "setup.continue": "Продолжить → вход",
    "setup.localNote.pre": "Данные хранятся только у тебя (",
    "setup.localNote.post": "), в облако ничего не уходит.",
    "setup.err.bad_api_id": "api_id — это число из my.telegram.org.",
    "setup.err.bad_api_hash":
      "api_hash — это 32 символа (hex). Проверь, что скопировал целиком.",
    "setup.err.bad_phone": "Телефон в формате +99955... (с кодом страны).",
    "setup.err.default": "Не удалось сохранить. Проверь поля.",

    "login.title": "NetGram — вход",
    "login.sending": "Отправляю код в Telegram...",
    "login.retry": "Повторить отправку кода",
    "login.codeSent": "Код отправлен в Telegram.",
    "login.codePlaceholder": "Код из Telegram",
    "login.signin": "Войти",
    "login.checking": "Проверяю...",
    "login.twofaHint": "Включена 2FA — введи пароль.",
    "login.twofaPlaceholder": "2FA пароль",
    "login.confirm": "Подтвердить",
    "login.done": "Готово, переходим...",
    "login.err.sendCode": "Не удалось отправить код",
    "login.err.badCode": "Неверный код",
    "login.err.badPassword": "Неверный пароль",
  },
  en: {
    "nav.permissions": "Permissions",
    "nav.drafts": "Drafts",
    "nav.connect": "Connect MCP",
    "user.loading": "Loading...",
    "lang.label": "Language",

    "connect.title": "Connect MCP",
    "connect.desc":
      "NetGram serves its own MCP server over HTTP. Add it to Claude Code, Claude Desktop or Cursor — there is nothing to install.",
    "connect.cli": "Claude Code (terminal)",
    "connect.json": "Claude Desktop / Cursor — config file",
    "connect.copy": "Copy",
    "connect.copied": "Copied",
    "connect.noToken":
      "No token is set — the port is open without auth. That happens in dev or Docker; the Mac app always sets one.",
    "connect.tools": "What the agent gets",
    "connect.safety":
      "Over MCP nothing can grant itself access or approve a draft — that stays manual, here. Sending happens immediately only in chats set to “Full”.",

    "permissions.title": "Permissions",
    "permissions.desc":
      "Read — AI sees messages. Write — AI proposes drafts (you approve manually). Full — AI acts on its own, with no approval.",
    "permissions.search": "Search chats and channels by name...",
    "permissions.refresh": "↻ Refresh",
    "permissions.refreshing": "Refreshing…",
    "filter.all": "All types",
    "filter.user": "People",
    "filter.bot": "Bots",
    "filter.group": "Groups",
    "filter.channel": "Channels",
    "sidebar.collapse": "Collapse panel",
    "sidebar.expand": "Expand panel",
    "permissions.empty": "Nothing found.",
    "permissions.loading": "Loading chats...",
    "permissions.error": "Failed to load chats",

    "level.read": "Read",
    "level.write": "Write",
    "level.full": "Full",
    "level.read.tip": "AI can read this chat's messages.",
    "level.write.tip":
      "AI proposes messages and button clicks — you approve them manually in Drafts.",
    "level.full.tip":
      "Full access: AI acts on its own, with no approval — sends and clicks instantly. Use with care.",

    "drafts.title": "Drafts",
    "drafts.desc":
      "Actions proposed by the AI: messages and button clicks. They run in Telegram only from here — manually.",
    "drafts.empty.pre": "No drafts. The AI creates them with",
    "drafts.empty.or": "or",
    "drafts.loading": "Loading drafts...",
    "drafts.error": "Failed to load drafts",

    "draft.kind.message": "message",
    "draft.kind.click": "click · msg #",
    "draft.badge.done": "Done",
    "draft.badge.click": "Click",
    "draft.badge.draft": "Draft",
    "draft.pressButton": "Press button",
    "draft.botAnswer": "Bot answer:",
    "draft.confirm.send": "Send to Telegram?",
    "draft.confirm.click": "Press this button in Telegram?",
    "draft.confirm.irreversible": "This can't be undone.",

    "btn.send": "Send",
    "btn.press": "Press",
    "btn.delete": "Delete",
    "btn.cancel": "Cancel",
    "btn.confirm": "Yes, do it",
    "btn.sending": "Sending...",
    "btn.clicking": "Clicking...",

    "err.chat_not_writable": "Chat is no longer writable — action blocked.",
    "err.already_sent": "Already done.",
    "err.draft_not_found": "Draft not found.",
    "err.invalid_click_draft": "Click draft is corrupted.",
    "err.default": "Action failed.",

    "setup.title": "NetGram — setup",
    "setup.desc":
      "NetGram uses your own Telegram application. This is a one-time step — everything is stored locally.",
    "setup.step1.pre": "1. Open",
    "setup.step1.post": "and sign in.",
    "setup.step2": "2. Create application (any name/platform).",
    "setup.step3.pre": "3. Copy the",
    "setup.step3.post": "→ paste them below.",
    "setup.phone": "Phone (with country code)",
    "setup.saving": "Saving...",
    "setup.continue": "Continue → sign in",
    "setup.localNote.pre": "Your data stays on this machine (",
    "setup.localNote.post": "), nothing goes to any cloud.",
    "setup.err.bad_api_id": "api_id is the number from my.telegram.org.",
    "setup.err.bad_api_hash":
      "api_hash is 32 hex characters. Make sure you copied all of it.",
    "setup.err.bad_phone": "Phone must look like +99955... (with country code).",
    "setup.err.default": "Could not save. Check the fields.",

    "login.title": "NetGram — sign in",
    "login.sending": "Sending the code to Telegram...",
    "login.retry": "Resend code",
    "login.codeSent": "Code sent to Telegram.",
    "login.codePlaceholder": "Code from Telegram",
    "login.signin": "Sign in",
    "login.checking": "Checking...",
    "login.twofaHint": "2FA is on — enter your password.",
    "login.twofaPlaceholder": "2FA password",
    "login.confirm": "Confirm",
    "login.done": "Done, redirecting...",
    "login.err.sendCode": "Could not send the code",
    "login.err.badCode": "Wrong code",
    "login.err.badPassword": "Wrong password",
  },
};

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<Ctx>({
  locale: "ru",
  setLocale: () => {},
  t: (k) => k,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") setLocaleState(saved);
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore storage failures (private mode etc.)
    }
  }

  const t = (key: string) => DICT[locale][key] ?? DICT.ru[key] ?? key;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n(): Ctx {
  return useContext(LocaleContext);
}
