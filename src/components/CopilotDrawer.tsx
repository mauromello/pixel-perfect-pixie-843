import { useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BotMessageSquare, Send, Square, X } from "lucide-react";
import { useRede } from "@/lib/network-store";
import { contextoCopilot, extrairAcoes } from "@/lib/copilot";
import { useT } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = ["Quais alimentadores têm maior PNT e por quê?", "Explique o cálculo da perda técnica MT.", "Como funcionam as regras CEMIG do item 4.1.1.2?"];

export function CopilotDrawer() {
  const t = useT();
  const navigate = useNavigate();
  const rota = useRouterState({ select: (s) => s.location.pathname });
  const { subestacoes, competencia, metodologia } = useRede();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [txt, setTxt] = useState("");
  const [enviando, setEnviando] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  async function enviar(pergunta: string) {
    if (!pergunta.trim() || enviando) return;
    const hist: Msg[] = [...msgs, { role: "user", content: pergunta.trim() }];
    setMsgs([...hist, { role: "assistant", content: "" }]);
    setTxt(""); setEnviando(true);
    const ac = new AbortController(); abort.current = ac;
    try {
      const r = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ac.signal,
        body: JSON.stringify({ mensagens: hist, contexto: contextoCopilot(subestacoes, competencia, metodologia, rota) }) });
      if (!r.ok || !r.body) {
        const e = await r.json().catch(() => ({ error: `Erro ${r.status}` }));
        throw new Error(e.error ?? `Erro ${r.status}`);
      }
      const rd = r.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) {
        const { done, value } = await rd.read(); if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...hist, { role: "assistant", content: acc }]);
        fim.current?.scrollIntoView({ block: "end" });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsgs([...hist, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally { setEnviando(false); abort.current = null; }
  }

  return (
    <>
      <button onClick={() => setAberto(true)} aria-label={t("Copilot Técnico")} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90">
        <BotMessageSquare size={18} /> {t("Copilot Técnico")}
      </button>
      {aberto && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl" aria-label={t("Copilot Técnico")}>
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <BotMessageSquare size={18} className="text-primary" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{t("Copilot Técnico")}</div>
              <div className="text-[11px] text-muted-foreground">{t("Balanço e regulação · competência")} {competencia}</div>
            </div>
            <button aria-label={t("Fechar")} onClick={() => setAberto(false)} className="rounded p-1 hover:bg-muted"><X size={16} /></button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground">{t("Pergunte sobre o balanço, perdas e regras regulatórias. As respostas usam os dados da rede desta sessão.")}</p>
                {SUGESTOES.map((s) => <button key={s} onClick={() => enviar(t(s))} className="block w-full rounded border px-3 py-2 text-left text-xs hover:bg-muted">{t(s)}</button>)}
              </div>
            )}
            {msgs.map((m, i) => {
              if (m.role === "user") return <div key={i} className="ml-8 rounded-lg bg-primary px-3 py-2 text-primary-foreground">{m.content}</div>;
              const { texto, acoes } = extrairAcoes(m.content);
              return (
                <div key={i}>
                  <div className="whitespace-pre-wrap leading-relaxed">{texto || (enviando && i === msgs.length - 1 ? t("Analisando…") : "")}</div>
                  {acoes.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{acoes.map((a) => (
                    <button key={a.rota} onClick={() => navigate({ to: a.rota })} className="rounded border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">{a.rotulo} →</button>
                  ))}</div>}
                </div>
              );
            })}
            <div ref={fim} />
          </div>
          <form className="border-t p-3" onSubmit={(e) => { e.preventDefault(); enviar(txt); }}>
            <div className="flex items-end gap-2">
              <textarea value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(txt); } }} rows={2} maxLength={4000} placeholder={t("Digite sua pergunta…")} className="inp flex-1 resize-none" />
              {enviando
                ? <button type="button" aria-label={t("Parar")} onClick={() => abort.current?.abort()} className="rounded bg-muted p-2.5"><Square size={16} /></button>
                : <button type="submit" aria-label={t("Enviar")} className="rounded bg-primary p-2.5 text-primary-foreground disabled:opacity-50" disabled={!txt.trim()}><Send size={16} /></button>}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">{t("Dados de demonstração. Respostas geradas por IA podem conter erros; confira nas telas.")}</p>
          </form>
        </aside>
      )}
    </>
  );
}
