import { useState, type FormEvent, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney, fmtPct, parseNum } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";
import type { JournalStats } from "@/lib/journal/types";

function Stat({
  label,
  value,
  tone = "default",
  hint,
  action,
}: {
  label: string;
  value: string;
  tone?: "default" | "equity" | "risk" | "avail" | "next";
  hint?: string;
  action?: ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    equity: "text-equity",
    risk: "text-danger",
    avail: "text-long",
    next: "text-next",
  };
  return (
    <div className="relative flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      {action ? <div className="absolute right-1.5 top-1.5">{action}</div> : null}
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${tones[tone]}`}>
        {value}
      </span>
      {hint ? (
        <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

export function StatsBar({ stats }: { stats: JournalStats }) {
  const setStartingEquity = useJournal((s) => s.setStartingEquity);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = parseNum(value);
    if (!(n > 0)) return;
    setStartingEquity(n);
    setOpen(false);
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Стартовый"
          value={fmtMoney(stats.startingEquity)}
          action={
            <button
              type="button"
              aria-label="Изменить стартовый депозит"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setValue(
                  stats.startingEquity.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                );
                setOpen(true);
              }}
            >
              <Settings className="size-3.5" />
            </button>
          }
        />
        <Stat
          label="Текущий депозит"
          value={fmtMoney(stats.currentEquity)}
          tone="equity"
          hint="тейки + касса"
        />
        <Stat
          label="Открытый риск"
          value={fmtMoney(stats.openRisk)}
          tone="risk"
          hint={`${stats.riskOnCount} со стопом · ${stats.openCount} открытых`}
        />
        <Stat
          label="Доступно"
          value={fmtMoney(stats.available)}
          tone="avail"
          hint="депозит − открытый риск"
        />
        <Stat
          label="Риск след. сделки"
          value={fmtMoney(stats.nextRisk)}
          tone="next"
          hint="1% от доступно"
        />
        <Stat
          label="Winrate"
          value={stats.winrate == null ? "—" : fmtPct(stats.winrate * 100, 1)}
          hint={`${stats.wins}W / ${stats.losses}L / ${stats.be} BE`}
        />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Стартовый депозит</DialogTitle>
          <DialogDescription>
            База, от которой считается кривая и сложный процент. Сделки не
            пересчитываются — меняется только точка старта.
          </DialogDescription>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start-eq">Сумма, $</Label>
              <Input
                id="start-eq"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit">Сохранить</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
