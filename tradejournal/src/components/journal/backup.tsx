import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { backupFilename, journalToTxt, txtToJournal } from "@/lib/journal/txt";
import { useJournal } from "@/lib/journal/store";

export function JournalBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof txtToJournal> | null>(
    null,
  );
  const replaceJournal = useJournal((s) => s.replaceJournal);
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const hydrated = useJournal((s) => s.hydrated);

  function exportTxt() {
    const text = journalToTxt({ startingEquity, trades, cashMoves });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = txtToJournal(text);
        if (!parsed.trades.length && !parsed.cashMoves.length && !text.trim()) {
          setError("Файл пустой.");
          return;
        }
        setPending(parsed);
      } catch {
        setError("Не получилось прочитать файл. Нужен TXT журнала.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="outline" onClick={exportTxt} disabled={!hydrated}>
        <Download className="size-4" />
        Выгрузить
      </Button>
      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        disabled={!hydrated}
      >
        <Upload className="size-4" />
        Загрузить
      </Button>

      <Dialog open={Boolean(error)} onOpenChange={(v) => !v && setError(null)}>
        <DialogContent>
          <DialogTitle>Файл не принят</DialogTitle>
          <DialogDescription>{error}</DialogDescription>
          <Button className="mt-4" variant="outline" onClick={() => setError(null)}>
            Понятно
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pending)} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogTitle>Загрузить журнал?</DialogTitle>
          <DialogDescription>
            Текущие сделки заменятся данными из файла
            {pending
              ? ` (${pending.trades.length} сделок, ${pending.cashMoves.length} записей кассы).`
              : "."}
          </DialogDescription>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setPending(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pending) return;
                replaceJournal(pending);
                setPending(null);
              }}
            >
              Заменить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
