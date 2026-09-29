import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeTrade } from "./seed";
import type { CashMove, JournalPayload, Trade } from "./types";

type JournalRow = {
  starting_equity: string | number;
  trades: Trade[] | string;
  cash_moves: CashMove[] | string;
};

function parseJson<T>(value: T[] | string | null | undefined): T[] {
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as T[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function toPayload(row: JournalRow): JournalPayload {
  return {
    startingEquity: Number(row.starting_equity) || 0,
    trades: parseJson<Trade>(row.trades).map(normalizeTrade),
    cashMoves: parseJson<CashMove>(row.cash_moves),
  };
}

export const loadJournal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<JournalRow>(
      "select starting_equity, trades, cash_moves from journal_state where user_id = $1",
      [context.userId],
    );
    const row = rows[0];
    if (!row) return null;
    return toPayload(row);
  });

export const saveJournal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: JournalPayload) => ({
    startingEquity: Number(data.startingEquity) || 0,
    trades: (data.trades ?? []).map(normalizeTrade),
    cashMoves: data.cashMoves ?? [],
  }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      `insert into journal_state (user_id, starting_equity, trades, cash_moves, updated_at)
       values ($1, $2, $3::jsonb, $4::jsonb, now())
       on conflict (user_id) do update set
         starting_equity = excluded.starting_equity,
         trades = excluded.trades,
         cash_moves = excluded.cash_moves,
         updated_at = now()`,
      [
        context.userId,
        data.startingEquity,
        JSON.stringify(data.trades),
        JSON.stringify(data.cashMoves),
      ],
    );
    return { ok: true as const };
  });
