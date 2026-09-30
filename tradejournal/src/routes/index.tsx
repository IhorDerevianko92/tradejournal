import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Plus, X } from "lucide-react";
import { CashForm } from "@/components/journal/cash-form";
import { CashTable } from "@/components/journal/cash-table";
import { CloseTradeForm } from "@/components/journal/close-trade-form";
import { EquityChart } from "@/components/journal/equity-chart";
import { JournalBackup } from "@/components/journal/backup";
import { MonthPnl } from "@/components/journal/month-pnl";
import { OpenTradeForm } from "@/components/journal/open-trade-form";
import { OpenTrades } from "@/components/journal/open-trades";
import { StatsBar } from "@/components/journal/stats-bar";
import { TradeInfoCard } from "@/components/journal/trade-info";
import { TradeTable } from "@/components/journal/trade-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { computeJournal } from "@/lib/journal/engine";
import { useJournal } from "@/lib/journal/store";
import type { ComputedRow } from "@/lib/journal/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <JournalSkeleton />;
  if (!user) return <RedirectToSignIn />;
  return <JournalApp />;
}

function JournalSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 h-16 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-card" />
        ))}
      </div>
      <div className="mt-4 h-56 animate-pulse rounded-xl bg-card" />
    </main>
  );
}

function JournalApp() {
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const hydrate = useJournal((s) => s.hydrate);
  const hydrated = useJournal((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const stats = useMemo(
    () => computeJournal(startingEquity, trades, cashMoves),
    [startingEquity, trades, cashMoves],
  );
  const [composing, setComposing] = useState(false);
  const [cashForm, setCashForm] = useState(false);
  const [managing, setManaging] = useState<ComputedRow | null>(null);
  const [info, setInfo] = useState<ComputedRow | null>(null);
  const [tab, setTab] = useState("all");

  const visible =
    tab === "open"
      ? stats.rows.filter((r) => r.status === "open")
      : tab === "closed"
        ? stats.rows.filter((r) => r.status === "closed")
        : stats.rows;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Журнал сделок
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <JournalBackup />
          <Button variant="secondary" onClick={() => setCashForm(true)}>
            <Banknote className="size-4" />
            Касса
          </Button>
          <Button
            variant={composing ? "outline" : "default"}
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? <X className="size-4" /> : <Plus className="size-4" />}
            {composing ? "Отмена" : "Открыть сделку"}
          </Button>
          <UserButton />
        </div>
      </header>

      {!hydrated ? (
        <JournalSkeleton />
      ) : (
        <>
          <div className="relative overflow-hidden">
            <div
              className={
                composing
                  ? "pointer-events-none absolute inset-x-0 top-0 -translate-y-2 opacity-0 transition-[opacity,transform] duration-200 ease-out"
                  : "translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out"
              }
              aria-hidden={composing}
              inert={composing || undefined}
            >
              <MonthPnl rows={stats.rows} />
              <div className="mt-3">
                <StatsBar stats={stats} />
              </div>
              <div className="mt-4">
                <EquityChart
                  startingEquity={stats.startingEquity}
                  rows={stats.rows}
                  cashMoves={cashMoves}
                />
              </div>
            </div>
            <div
              className={
                composing
                  ? "relative translate-y-0 opacity-100 transition-[opacity,transform] duration-200 ease-out"
                  : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0 transition-[opacity,transform] duration-200 ease-out"
              }
              aria-hidden={!composing}
              inert={!composing || undefined}
            >
              <OpenTradeForm
                active={composing}
                available={stats.available}
                onDone={() => setComposing(false)}
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-5">
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap">
              <TabsTrigger value="all">Все ({stats.tradeCount})</TabsTrigger>
              <TabsTrigger value="open">Открытые ({stats.openCount})</TabsTrigger>
              <TabsTrigger value="closed">
                Закрытые ({stats.tradeCount - stats.openCount})
              </TabsTrigger>
              <TabsTrigger value="cash">Касса ({cashMoves.length})</TabsTrigger>
            </TabsList>
            {tab === "cash" ? (
              <TabsContent value="cash">
                <CashTable />
              </TabsContent>
            ) : tab === "open" ? (
              <TabsContent value="open">
                <OpenTrades rows={visible} onManage={setManaging} onInfo={setInfo} />
              </TabsContent>
            ) : (
              <TabsContent value={tab}>
                <TradeTable
                  rows={visible}
                  onManage={setManaging}
                  dateMode={tab === "closed" ? "close" : "open"}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      <CashForm open={cashForm} onOpenChange={setCashForm} />
      <CloseTradeForm trade={managing} onClose={() => setManaging(null)} />
      <TradeInfoCard trade={info} onClose={() => setInfo(null)} />
    </main>
  );
}
