import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/journal/confirm-delete";
import { fmtDate, fmtMoneySigned } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";
import type { CashMove } from "@/lib/journal/types";

export function CashTable() {
  const cashMoves = useJournal((s) => s.cashMoves);
  const deleteCash = useJournal((s) => s.deleteCash);
  const [kill, setKill] = useState<CashMove | null>(null);
  const rows = [...cashMoves].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="bg-header text-header-foreground">
            {["Дата", "Тип", "Сумма", "Комментарий", ""].map((h) => (
              <th
                key={h}
                className="px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                Касса пустая.
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-border bg-card odd:bg-card even:bg-row-alt"
              >
                <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {fmtDate(c.date)}
                </td>
                <td className="px-2.5 py-2">
                  {c.amount >= 0 ? "Пополнение" : "Вывод"}
                </td>
                <td
                  className={`px-2.5 py-2 font-mono tabular-nums ${
                    c.amount >= 0 ? "text-long" : "text-short"
                  }`}
                >
                  {fmtMoneySigned(c.amount)}
                </td>
                <td className="px-2.5 py-2">{c.note || "—"}</td>
                <td className="px-2.5 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setKill(c)}
                  >
                    ×
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ConfirmDelete
        open={!!kill}
        title={kill ? `Запись кассы «${kill.note || "без комментария"}» будет удалена.` : ""}
        onCancel={() => setKill(null)}
        onConfirm={() => {
          if (kill) deleteCash(kill.id);
          setKill(null);
        }}
      />
    </div>
  );
}
