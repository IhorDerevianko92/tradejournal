export type Direction = "Long" | "Short";
export type Outcome = "win" | "loss" | "be";
export type TradeStatus = "open" | "closed";

export type Realization = {
  id: string;
  date: string;
  amount: number;
  note: string;
  kind: "partial" | "close";
};

export type CashMove = {
  id: string;
  date: string;
  amount: number;
  note: string;
};

export type Trade = {
  id: string;
  pair: string;
  date: string;
  direction: Direction;
  riskPct: number;
  rr: number | null;
  outcome: Outcome | null;
  status: TradeStatus;
  note: string;
  equityAtEntry: number;
  /** Original frozen risk at open. Never recalculated. */
  riskUsd: number;
  /** 0 after moving the remainder to breakeven. */
  remainingRiskUsd: number;
  atBreakeven: boolean;
  realizations: Realization[];
  stopPct: number | null;
  /** Account size used for the 1% (defaults to "доступно"). */
  accountSize: number | null;
  entryPrice: number | null;
  /** Planned invalidation / stop (цена закрытия). */
  stopPrice: number | null;
  takeProfit: number | null;
  /** Commission % on open, e.g. 0.02. */
  feeOpen: number;
  feeClose: number;
  /** Position size in coins. */
  volume: number | null;
};

export type ComputedRow = Trade & {
  realizedPnl: number;
  resultPct: number;
  rMultiple: number | null;
  equityAfter: number;
  positionUsd: number | null;
  closedAt: string | null;
};

export type CurvePoint = {
  name: string;
  equity: number;
};

export type JournalStats = {
  startingEquity: number;
  currentEquity: number;
  openRisk: number;
  available: number;
  nextRisk: number;
  deposits: number;
  withdrawals: number;
  tradeCount: number;
  winrate: number | null;
  sumR: number;
  wins: number;
  losses: number;
  be: number;
  longs: number;
  shorts: number;
  openCount: number;
  riskOnCount: number;
  rows: ComputedRow[];
  curve: CurvePoint[];
};

export type JournalPayload = {
  startingEquity: number;
  trades: Trade[];
  cashMoves: CashMove[];
};
