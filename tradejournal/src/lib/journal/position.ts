import { round2, suggestedRisk } from "./engine";
import type { Direction } from "./types";

export type PositionInput = {
  direction: Direction;
  accountSize: number;
  riskPct: number;
  entry: number;
  stop: number;
  take: number;
  feeOpen: number;
  feeClose: number;
};

export type PositionResult = {
  riskUsd: number;
  volume: number | null;
  notional: number | null;
  rr: number | null;
  stopDistance: number | null;
  validStop: boolean;
  validTake: boolean;
};

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

/** Как у биржи / Sancho: 3,660… → 3,66 ед. */
export function roundQty(n: number) {
  const a = Math.abs(n);
  if (a >= 1) return Math.round(n * 100) / 100;
  if (a >= 0.01) return Math.round(n * 1e4) / 1e4;
  if (a >= 0.0001) return Math.round(n * 1e6) / 1e6;
  return round8(n);
}

export function calcPosition(input: PositionInput): PositionResult {
  const riskUsd = suggestedRisk(input.accountSize, input.riskPct);
  const { entry, stop, take, direction, feeOpen, feeClose } = input;
  const long = direction === "Long";

  if (!(entry > 0) || !(stop > 0)) {
    return {
      riskUsd,
      volume: null,
      notional: null,
      rr: null,
      stopDistance: null,
      validStop: false,
      validTake: false,
    };
  }

  const stopDist = long ? entry - stop : stop - entry;
  const validStop = stopDist > 0;
  const takeDist = take > 0 ? (long ? take - entry : entry - take) : 0;
  const validTake = take > 0 && takeDist > 0;
  const rr = validStop && validTake ? round2(takeDist / stopDist) : null;

  if (!validStop || riskUsd <= 0) {
    return {
      riskUsd,
      volume: null,
      notional: null,
      rr,
      stopDistance: stopDist,
      validStop,
      validTake,
    };
  }

  const lossPerUnit =
    stopDist + entry * (feeOpen / 100) + stop * (feeClose / 100);
  const rawVolume = lossPerUnit > 0 ? riskUsd / lossPerUnit : null;
  const volume = rawVolume != null ? roundQty(rawVolume) : null;
  const notional = volume != null ? round2(volume * entry) : null;

  return {
    riskUsd,
    volume,
    notional,
    rr,
    stopDistance: stopDist,
    validStop,
    validTake,
  };
}
