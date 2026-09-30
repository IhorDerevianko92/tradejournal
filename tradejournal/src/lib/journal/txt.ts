import { newId, round2 } from "./engine";
import { DEFAULT_STARTING_EQUITY, normalizeTrade } from "./seed";
import type {
  CashMove,
  Direction,
  JournalPayload,
  Outcome,
  Realization,
  Trade,
  TradeStatus,
} from "./types";

const DASH = "-";

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return DASH;
  return String(v).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function num(v: string | undefined): number | null {
  if (v == null || v === "" || v === DASH) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function text(v: string | undefined): string {
  if (v == null || v === DASH) return "";
  return v;
}

export function journalToTxt(data: JournalPayload): string {
  const lines: string[] = [
    "ЖУРНАЛ	v1",
    `# Журнал сделок. Строки с # пропускаются.`,
    `# СДЕЛКА: id, пара, дата, направление, статус, риск%, риск$, остаток риска, бу, rr, итог, счёт, вход, стоп, тейк, комис.вход, комис.выход, объём, заметка`,
    `# ТЕЙК: id_сделки, дата, сумма, вид (partial|close), заметка`,
    `# КАССА: id, дата, сумма, заметка`,
    `СТАРТ	${round2(data.startingEquity)}`,
    "",
  ];

  for (const t of data.trades) {
    lines.push(
      [
        "СДЕЛКА",
        cell(t.id),
        cell(t.pair),
        cell(t.date),
        cell(t.direction),
        cell(t.status),
        cell(t.riskPct),
        cell(t.riskUsd),
        cell(t.remainingRiskUsd),
        t.atBreakeven ? "1" : "0",
        cell(t.rr),
        cell(t.outcome),
        cell(t.accountSize),
        cell(t.entryPrice),
        cell(t.stopPrice),
        cell(t.takeProfit),
        cell(t.feeOpen),
        cell(t.feeClose),
        cell(t.volume),
        cell(t.note),
      ].join("\t"),
    );
    for (const r of t.realizations) {
      lines.push(
        ["ТЕЙК", cell(t.id), cell(r.date), cell(r.amount), cell(r.kind), cell(r.note)].join(
          "\t",
        ),
      );
    }
  }

  if (data.cashMoves.length) lines.push("");
  for (const c of data.cashMoves) {
    lines.push(["КАССА", cell(c.id), cell(c.date), cell(c.amount), cell(c.note)].join("\t"));
  }

  return `${lines.join("\n")}\n`;
}

function parseDirection(v: string): Direction {
  return /short/i.test(v) ? "Short" : "Long";
}

function parseStatus(v: string): TradeStatus {
  const s = v.trim().toLowerCase();
  if (s === "closed" || s === "закрыта" || s === "закрыт") return "closed";
  return "open";
}

function parseOutcome(v: string): Outcome | null {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "✓" || s === "плюс") return "win";
  if (s === "loss" || s === "✗" || s === "минус") return "loss";
  if (s === "be" || s === "б/о" || s === "бу") return "be";
  return null;
}

export function txtToJournal(raw: string): JournalPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      startingEquity: DEFAULT_STARTING_EQUITY,
      trades: [],
      cashMoves: [],
    };
  }

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as Partial<JournalPayload>;
    return {
      startingEquity: Number(parsed.startingEquity) || DEFAULT_STARTING_EQUITY,
      trades: (parsed.trades ?? []).map(normalizeTrade),
      cashMoves: parsed.cashMoves ?? [],
    };
  }

  const trades = new Map<string, Trade>();
  const order: string[] = [];
  const cashMoves: CashMove[] = [];
  let startingEquity = DEFAULT_STARTING_EQUITY;

  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const cols = s.split("\t").map((c) => c.trim());
    const kind = cols[0]?.toUpperCase();

    if (kind === "ЖУРНАЛ" || kind === "JOURNAL") continue;

    if (kind === "СТАРТ" || kind === "START") {
      startingEquity = num(cols[1]) ?? startingEquity;
      continue;
    }

    if (kind === "СДЕЛКА" || kind === "TRADE") {
      const id = text(cols[1]) || newId();
      const trade = normalizeTrade({
        id,
        pair: text(cols[2]),
        date: text(cols[3]),
        direction: parseDirection(text(cols[4])),
        status: parseStatus(text(cols[5])),
        riskPct: num(cols[6]) ?? 1,
        riskUsd: num(cols[7]) ?? 0,
        remainingRiskUsd: num(cols[8]) ?? undefined,
        atBreakeven: cols[9] === "1" || cols[9] === "true",
        rr: num(cols[10]),
        outcome: parseOutcome(text(cols[11])),
        accountSize: num(cols[12]),
        entryPrice: num(cols[13]),
        stopPrice: num(cols[14]),
        takeProfit: num(cols[15]),
        feeOpen: num(cols[16]) ?? 0.02,
        feeClose: num(cols[17]) ?? 0.02,
        volume: num(cols[18]),
        note: text(cols[19]),
        realizations: [],
      });
      trades.set(id, trade);
      order.push(id);
      continue;
    }

    if (kind === "ТЕЙК" || kind === "REALIZATION") {
      const tradeId = text(cols[1]);
      const trade = trades.get(tradeId);
      if (!trade) continue;
      const r: Realization = {
        id: newId(),
        date: text(cols[2]),
        amount: round2(num(cols[3]) ?? 0),
        kind: cols[4] === "close" ? "close" : "partial",
        note: text(cols[5]),
      };
      trade.realizations = [...trade.realizations, r];
      continue;
    }

    if (kind === "КАССА" || kind === "CASH") {
      cashMoves.push({
        id: text(cols[1]) || newId(),
        date: text(cols[2]),
        amount: round2(num(cols[3]) ?? 0),
        note: text(cols[4]),
      });
    }
  }

  return {
    startingEquity,
    trades: order.map((id) => trades.get(id)!).filter(Boolean),
    cashMoves,
  };
}

export function backupFilename(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `zhurnal-sdelok-${y}-${m}-${day}.txt`;
}
