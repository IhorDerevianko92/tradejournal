import { create } from "zustand";
import { computeJournal, newId, round2 } from "./engine";
import { DEFAULT_STARTING_EQUITY, freezeOpenTrade, normalizeTrade } from "./seed";
import { loadJournal, saveJournal } from "./api";
import type { CashMove, Direction, JournalPayload, Trade } from "./types";

const CACHE_KEYS = ["trade-journal-v7", "trade-journal-v5", "trade-journal-v4"] as const;
const HYDRATE_MS = 8000;

type JournalStore = {
  startingEquity: number;
  trades: Trade[];
  cashMoves: CashMove[];
  hydrated: boolean;
  hydrating: boolean;
  persistError: string | null;
  setStartingEquity: (n: number) => void;
  openTrade: (input: {
    pair: string;
    date: string;
    direction: Direction;
    riskPct: number;
    accountSize: number;
    entryPrice: number;
    stopPrice: number;
    takeProfit: number;
    feeOpen: number;
    feeClose: number;
    stopPct?: number | null;
    note?: string;
  }) => Trade;
  addRealization: (input: {
    tradeId: string;
    amount: number;
    note: string;
    date: string;
    moveToBe: boolean;
    close: boolean;
  }) => void;
  addCash: (input: { date: string; amount: number; note: string }) => void;
  deleteCash: (id: string) => void;
  deleteTrade: (id: string) => void;
  replaceJournal: (payload: JournalPayload) => Promise<void>;
  hydrate: () => Promise<void>;
};

function emptyJournal(): JournalPayload {
  return {
    startingEquity: DEFAULT_STARTING_EQUITY,
    trades: [],
    cashMoves: [],
  };
}

function cleanPayload(src: JournalPayload | null): JournalPayload {
  if (!src) return emptyJournal();
  return {
    startingEquity: src.startingEquity || DEFAULT_STARTING_EQUITY,
    trades: src.trades,
    cashMoves: src.cashMoves ?? [],
  };
}

function readLocalCache(): JournalPayload | null {
  if (typeof window === "undefined") return null;
  for (const key of CACHE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        state?: JournalPayload;
        startingEquity?: number;
        trades?: Trade[];
        cashMoves?: CashMove[];
      };
      const src = parsed.state ?? parsed;
      const trades = src.trades;
      if (!Array.isArray(trades)) continue;
      return {
        startingEquity: src.startingEquity ?? DEFAULT_STARTING_EQUITY,
        trades: trades.map(normalizeTrade),
        cashMoves: src.cashMoves ?? [],
      };
    } catch {
      /* ignore corrupt cache */
    }
  }
  return null;
}

function writeLocalCache(payload: JournalPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      "trade-journal-v7",
      JSON.stringify({ state: payload, version: 7 }),
    );
  } catch {
    /* quota */
  }
}

function snapshot(get: () => JournalStore): JournalPayload {
  const s = get();
  return {
    startingEquity: s.startingEquity,
    trades: s.trades,
    cashMoves: s.cashMoves,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export const useJournal = create<JournalStore>()((set, get) => {
  const persist = async () => {
    if (!get().hydrated) return;
    const data = snapshot(get);
    writeLocalCache(data);
    try {
      await saveJournal({ data });
      set({ persistError: null });
    } catch {
      set({ persistError: "Сервер не сохранил журнал. Данные есть на этом устройстве." });
      throw new Error("persist-failed");
    }
  };

  return {
    startingEquity: DEFAULT_STARTING_EQUITY,
    trades: [],
    cashMoves: [],
    hydrated: false,
    hydrating: false,
    persistError: null,
    setStartingEquity: (n) => {
      set({ startingEquity: n });
      void persist().catch(() => {});
    },
    openTrade: (input) => {
      const stats = computeJournal(
        get().startingEquity,
        get().trades,
        get().cashMoves,
      );
      const trade = freezeOpenTrade({
        ...input,
        currentEquity: stats.currentEquity,
        accountSize: input.accountSize || stats.available,
      });
      set({ trades: [...get().trades, trade] });
      void persist().catch(() => {});
      return trade;
    },
    addRealization: ({ tradeId, amount, note, date, moveToBe, close }) => {
      const pnl = Number.isFinite(amount) ? round2(amount) : 0;
      set({
        trades: get().trades.map((t) => {
          if (t.id !== tradeId) return t;
          const realizations = [...t.realizations];
          if (close || pnl !== 0) {
            realizations.push({
              id: newId(),
              date,
              amount: pnl,
              note,
              kind: close ? "close" : "partial",
            });
          }
          const total = realizations.reduce((s, r) => s + r.amount, 0);
          const atBreakeven = moveToBe || close || t.atBreakeven;
          const outcome = close
            ? total > 0
              ? "win"
              : total < 0
                ? "loss"
                : "be"
            : t.outcome;
          return {
            ...t,
            realizations,
            atBreakeven,
            remainingRiskUsd: atBreakeven || close ? 0 : t.remainingRiskUsd,
            status: close ? ("closed" as const) : t.status,
            outcome,
            riskUsd: t.riskUsd,
            equityAtEntry: t.equityAtEntry,
          };
        }),
      });
      void persist().catch(() => {});
    },
    addCash: ({ date, amount, note }) => {
      if (!amount) return;
      set({
        cashMoves: [
          ...get().cashMoves,
          { id: newId(), date, amount: round2(amount), note: note.trim() },
        ],
      });
      void persist().catch(() => {});
    },
    deleteCash: (id) => {
      set({ cashMoves: get().cashMoves.filter((c) => c.id !== id) });
      void persist().catch(() => {});
    },
    deleteTrade: (id) => {
      set({ trades: get().trades.filter((t) => t.id !== id) });
      void persist().catch(() => {});
    },
    replaceJournal: async (payload) => {
      const next = cleanPayload({
        startingEquity: payload.startingEquity,
        trades: payload.trades.map(normalizeTrade),
        cashMoves: payload.cashMoves ?? [],
      });
      set({
        startingEquity: next.startingEquity,
        trades: next.trades,
        cashMoves: next.cashMoves,
        hydrated: true,
        hydrating: false,
        persistError: null,
      });
      await persist();
    },
    hydrate: async () => {
      if (get().hydrated || get().hydrating) return;
      set({ hydrating: true });
      const apply = (raw: JournalPayload | null, persistRemote: boolean) => {
        if (get().hydrated) return;
        const next = cleanPayload(raw);
        set({
          startingEquity: next.startingEquity,
          trades: next.trades,
          cashMoves: next.cashMoves,
          hydrated: true,
          hydrating: false,
        });
        writeLocalCache(next);
        if (persistRemote) void saveJournal({ data: next }).catch(() => {});
      };
      try {
        const remote = await withTimeout(loadJournal(), HYDRATE_MS);
        if (get().hydrated) return;
        if (remote) {
          apply(remote, false);
          return;
        }
        apply(readLocalCache(), true);
      } catch {
        if (get().hydrated) return;
        apply(readLocalCache(), false);
      } finally {
        if (!get().hydrated) apply(readLocalCache(), false);
        else if (get().hydrating) set({ hydrating: false });
      }
    },
  };
});
