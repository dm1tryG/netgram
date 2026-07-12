"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "ru" | "en";

const STORAGE_KEY = "netgram_locale";

const DICT: Record<Locale, Record<string, string>> = {
  ru: {
    "nav.permissions": "Разрешения",
    "nav.drafts": "Черновики",
    "user.loading": "Загрузка...",
    "lang.label": "Язык",

    "permissions.title": "Разрешения",
    "permissions.desc":
      "Чтение — AI видит сообщения. Запись — AI предлагает черновики (подтверждаешь вручную). Полный — AI действует сам через CLI без подтверждения.",
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
      "Полный доступ: AI действует сам через CLI без подтверждения — отправляет и кликает сразу. Используй осторожно.",

    "drafts.title": "Черновики",
    "drafts.desc":
      "Действия, предложенные через CLI: сообщения (netgram draft) и клики по кнопкам (netgram click). Выполняются в Telegram только отсюда — вручную.",
    "drafts.empty.pre": "Черновиков нет. Создай через",
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
  },
  en: {
    "nav.permissions": "Permissions",
    "nav.drafts": "Drafts",
    "user.loading": "Loading...",
    "lang.label": "Language",

    "permissions.title": "Permissions",
    "permissions.desc":
      "Read — AI sees messages. Write — AI proposes drafts (you approve manually). Full — AI acts on its own via the CLI with no approval.",
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
      "Full access: AI acts on its own via the CLI with no approval — sends and clicks instantly. Use with care.",

    "drafts.title": "Drafts",
    "drafts.desc":
      "Actions proposed via CLI: messages (netgram draft) and button clicks (netgram click). They run in Telegram only from here — manually.",
    "drafts.empty.pre": "No drafts. Create one with",
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
