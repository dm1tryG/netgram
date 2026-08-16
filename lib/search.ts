// Search across the chats the human allowed for reading.
//
// Telegram offers two ways to search and neither fits on its own:
//
//   messages.searchGlobal — one round-trip over the whole account, but it
//     returns hits from every chat, including the ones the agent must not see.
//     Filtering those out afterwards is fine when most chats are allowed and
//     useless when few are: a real allowlist of 4 chats out of 782 dialogs cut
//     500 scanned messages down to zero hits.
//
//   messages.search per chat — exact, exhaustive, and blind to everything the
//     human didn't allow, at the cost of one round-trip per chat.
//
// NetGram's whole premise is a short allowlist, so per-chat fan-out is the
// default and global search is the fallback for accounts that opened up a lot
// of chats. Either way the allowlist decides what comes back — this module is
// the only place that runs a search, so there is one gate, not two.
import {
  getDialogList,
  searchChatMessages,
  searchGlobalPage,
  type DialogKind,
  type DialogSummary,
  type GlobalSearchOffset,
  type MessageHit,
} from "./telegram";
import { getAllowlist, isReadAllowed } from "./allowlist";

// Long messages blow up an agent's context for no gain — a hit is a pointer,
// read_messages fetches the full thing.
const SNIPPET_MAX = 300;

// Above this many allowed chats, per-chat fan-out costs more round-trips than
// scanning the account globally and throwing most of it away.
const FANOUT_MAX_CHATS = 20;

// Telegram tolerates parallel searches on distinct peers; keep it modest so a
// wide allowlist doesn't turn into a burst that trips flood limits.
const FANOUT_CONCURRENCY = 4;

// Telegram caps a search page at 100; five pages is ~500 scanned messages and
// still a bounded number of round-trips.
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export type SearchHit = {
  chatId: string;
  chatTitle: string;
  chatKind: DialogKind;
  messageId: number;
  date: number; // unix seconds
  fromId: string | null;
  text: string;
  truncated: boolean;
};

export type SearchResult = {
  hits: SearchHit[];
  // True when there may be more matches than were returned — the agent should
  // narrow the query rather than assume it saw everything.
  moreAvailable: boolean;
  // Which path ran, and how wide it looked. Useful when a search comes back
  // empty: "searched 4 chats" reads very differently from "scanned 500".
  strategy: "per-chat" | "global";
  chatsSearched?: number;
  scanned?: number;
};

// Thrown when the human hasn't granted read access to the chat asked for.
export class ChatNotAllowedError extends Error {}

export type SearchOptions = {
  query: string;
  limit: number;
  chatId?: string; // search one chat instead of everything allowed
  kind?: DialogKind;
  minDate?: number; // unix seconds
  maxDate?: number;
};

function snippet(text: string): { text: string; truncated: boolean } {
  if (text.length <= SNIPPET_MAX) return { text, truncated: false };
  return { text: text.slice(0, SNIPPET_MAX).trimEnd() + "…", truncated: true };
}

function inWindow(hit: MessageHit, opts: SearchOptions): boolean {
  if (opts.minDate && hit.date < opts.minDate) return false;
  if (opts.maxDate && hit.date >= opts.maxDate) return false;
  return true;
}

// Run `worker` over `items` a few at a time, preserving nothing but the results.
async function mapPooled<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  }
  return out;
}

export async function searchMessages(
  opts: SearchOptions
): Promise<SearchResult> {
  const dialogs = await getDialogList();
  const index = new Map(dialogs.map((d) => [d.id, d]));

  const decorate = (hit: MessageHit): SearchHit => {
    const meta = index.get(hit.chatId);
    const { text, truncated } = snippet(hit.text);
    return {
      chatId: hit.chatId,
      chatTitle: meta?.title ?? "",
      chatKind: meta?.kind ?? "user",
      messageId: hit.id,
      date: hit.date,
      fromId: hit.fromId,
      text,
      truncated,
    };
  };

  if (opts.chatId) {
    if (!isReadAllowed(opts.chatId)) throw new ChatNotAllowedError(opts.chatId);
    const hits = await searchChatMessages(opts.chatId, opts.query, opts.limit);
    return {
      hits: hits.filter((h) => inWindow(h, opts)).map(decorate),
      moreAvailable: hits.length >= opts.limit,
      strategy: "per-chat",
      chatsSearched: 1,
    };
  }

  const allowed = Object.entries(getAllowlist())
    .filter(([, perm]) => perm.read)
    .map(([id]) => index.get(id))
    .filter((d): d is DialogSummary => Boolean(d))
    .filter((d) => !opts.kind || d.kind === opts.kind);

  return allowed.length <= FANOUT_MAX_CHATS
    ? searchPerChat(allowed, opts, decorate)
    : searchGlobally(opts, index, decorate);
}

async function searchPerChat(
  chats: DialogSummary[],
  opts: SearchOptions,
  decorate: (hit: MessageHit) => SearchHit
): Promise<SearchResult> {
  // Each chat may hold every match, so ask each for a full page and cut after
  // merging — otherwise one busy chat could crowd out the rest.
  const perChat = await mapPooled(chats, FANOUT_CONCURRENCY, async (chat) => {
    try {
      return await searchChatMessages(chat.id, opts.query, opts.limit);
    } catch {
      // One unreachable chat (left, deleted, restricted) must not sink the
      // whole search — the other chats still have answers.
      return [] as MessageHit[];
    }
  });

  const merged = perChat
    .flat()
    .filter((hit) => inWindow(hit, opts))
    .sort((a, b) => b.date - a.date);

  // A chat that returned a full page was cut off by the limit, not exhausted —
  // there are older matches in it even if the merged list is short.
  const capped = perChat.some((chat) => chat.length >= opts.limit);

  return {
    hits: merged.slice(0, opts.limit).map(decorate),
    moreAvailable: capped || merged.length > opts.limit,
    strategy: "per-chat",
    chatsSearched: chats.length,
  };
}

async function searchGlobally(
  opts: SearchOptions,
  index: Map<string, DialogSummary>,
  decorate: (hit: MessageHit) => SearchHit
): Promise<SearchResult> {
  const hits: SearchHit[] = [];
  let offset: GlobalSearchOffset | undefined;
  let scanned = 0;
  let moreAvailable = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { hits: raw, next } = await searchGlobalPage({
      query: opts.query,
      limit: PAGE_SIZE,
      // usersOnly covers bots too, so "bot" still needs the exact check below —
      // the flag only saves round-trips.
      kind: opts.kind,
      minDate: opts.minDate,
      maxDate: opts.maxDate,
      offset,
    });
    scanned += raw.length;

    for (const hit of raw) {
      if (!isReadAllowed(hit.chatId)) continue;
      if (opts.kind && index.get(hit.chatId)?.kind !== opts.kind) continue;
      hits.push(decorate(hit));
      if (hits.length >= opts.limit) {
        return { hits, moreAvailable: true, strategy: "global", scanned };
      }
    }

    if (!next) break;
    offset = next;
    // Survived every page and Telegram still has more to give.
    if (page === MAX_PAGES - 1) moreAvailable = true;
  }

  return { hits, moreAvailable, strategy: "global", scanned };
}
