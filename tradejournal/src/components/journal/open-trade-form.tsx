import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { round2, suggestedRisk } from "@/lib/journal/engine";
import { fmtMoney, fmtR, fmtVolume, parseNum, todayIso } from "@/lib/journal/format";
import { calcPosition } from "@/lib/journal/position";
import { useJournal } from "@/lib/journal/store";
import type { Direction } from "@/lib/journal/types";

function num(v: string) {
  return parseNum(v);
}

export function OpenTradeForm({
  active,
  available,
  onDone,
}: {
  active: boolean;
  available: number;
  onDone: () => void;
}) {
  const openTrade = useJournal((s) => s.openTrade);
  const [pair, setPair] = useState("");
  const [date, setDate] = useState(todayIso);
  const [direction, setDirection] = useState<Direction>("Long");
  const [accountSize, setAccountSize] = useState("");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [feeOpen, setFeeOpen] = useState("0,02");
  const [feeClose, setFeeClose] = useState("0,02");
  const [take, setTake] = useState("");

  useEffect(() => {
    if (!active) return;
    setPair("");
    setDate(todayIso());
    setDirection("Long");
    setAccountSize(round2(available).toFixed(2).replace(".", ","));
    setRiskPct("1");
    setEntry("");
    setStop("");
    setFeeOpen("0,02");
    setFeeClose("0,02");
    setTake("");
  }, [active, available]);

  const size = num(accountSize);
  const pct = num(riskPct) || 1;
  const riskUsd = size > 0 ? suggestedRisk(size, pct) : 0;
  const calc = useMemo(
    () =>
      calcPosition({
        direction,
        accountSize: size,
        riskPct: pct,
        entry: num(entry),
        stop: num(stop),
        take: num(take),
        feeOpen: num(feeOpen),
        feeClose: num(feeClose),
      }),
    [direction, size, pct, entry, stop, take, feeOpen, feeClose],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pair.trim()) return;
    if (!(num(entry) > 0) || !(num(stop) > 0)) return;
    if (!calc.validStop) return;
    openTrade({
      pair,
      date: date || todayIso(),
      direction,
      riskPct: pct,
      accountSize: size,
      entryPrice: num(entry),
      stopPrice: num(stop),
      takeProfit: num(take) || 0,
      feeOpen: num(feeOpen),
      feeClose: num(feeClose),
    });
    onDone();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-next">
          Калькулятор позиции
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Открыть сделку</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Риск считается от размера счёта. По умолчанию — «доступно». Комиссии
          открытия и закрытия вычитаются из объёма.
        </p>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <div className="grid grid-cols-2 gap-1">
          <div className="grid gap-1.5">
            <Label htmlFor="coin">Монета</Label>
            <Input
              id="coin"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="BTC"
              required
              autoFocus
              className="h-11"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="open-date">Дата</Label>
            <Input
              id="open-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-11 scheme-dark"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Направление</Label>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                { id: "Long", label: "Лонг" },
                { id: "Short", label: "Шорт" },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDirection(d.id)}
                className={
                  d.id === direction
                    ? d.id === "Long"
                      ? "h-11 rounded-lg bg-long-bg text-sm font-semibold text-long"
                      : "h-11 rounded-lg bg-short-bg text-sm font-semibold text-short"
                    : "h-11 rounded-lg border border-border text-sm text-muted-foreground"
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="acc">Размер счёта, $</Label>
            <Input
              id="acc"
              inputMode="decimal"
              value={accountSize}
              onChange={(e) => setAccountSize(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="risk">Риск, %</Label>
            <Input
              id="risk"
              inputMode="decimal"
              value={riskPct}
              onChange={(e) => setRiskPct(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-next/30 bg-muted px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-next">
            Риск в долларах
          </p>
          <p className="font-mono text-xl font-semibold tabular-nums text-next">
            {fmtMoney(riskUsd)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pct.toLocaleString("ru-RU")}% от {fmtMoney(size)} (доступно{" "}
            {fmtMoney(available)})
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="entry">Цена открытия</Label>
              <Input
                id="entry"
                inputMode="decimal"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fee-open">Комиссия, %</Label>
              <Input
                id="fee-open"
                inputMode="decimal"
                value={feeOpen}
                onChange={(e) => setFeeOpen(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="stop">Цена закрытия (стоп)</Label>
              <Input
                id="stop"
                inputMode="decimal"
                value={stop}
                onChange={(e) => setStop(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fee-close">Комиссия, %</Label>
              <Input
                id="fee-close"
                inputMode="decimal"
                value={feeClose}
                onChange={(e) => setFeeClose(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="take">Тейк профит</Label>
            <Input
              id="take"
              inputMode="decimal"
              value={take}
              onChange={(e) => setTake(e.target.value)}
              placeholder="необязательно"
            />
          </div>
        </div>

        {num(entry) > 0 && num(stop) > 0 && !calc.validStop ? (
          <p className="text-sm text-danger">
            Для {direction === "Long" ? "лонга" : "шорта"} цена закрытия должна быть{" "}
            {direction === "Long" ? "ниже" : "выше"} цены открытия.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              В монетах
            </p>
            <p className="font-mono text-sm tabular-nums">
              {calc.volume != null ? `${fmtVolume(calc.volume)} ед.` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              В деньгах
            </p>
            <p className="font-mono text-sm tabular-nums">{fmtMoney(calc.notional)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Сумма риска
            </p>
            <p className="font-mono text-sm tabular-nums">{fmtMoney(calc.riskUsd)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              RR план
            </p>
            <p className="font-mono text-sm tabular-nums">{fmtR(calc.rr)}</p>
          </div>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Отмена
          </Button>
          <Button type="submit">Создать</Button>
        </div>
      </form>
    </section>
  );
}
