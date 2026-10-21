import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { INSTRUCOES_COPILOT } from "@/lib/copilot";

type Corpo = { mensagens: { role: "user" | "assistant"; content: string }[]; contexto: string };

export const Route = createFileRoute("/api/copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "Copilot não configurado." }, { status: 500 });
        let corpo: Corpo;
        try { corpo = await request.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
        const msgs = (corpo.mensagens ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12);
        if (!msgs.length || msgs.some((m) => m.content.length > 4000) || typeof corpo.contexto !== "string" || corpo.contexto.length > 8000) {
          return Response.json({ error: "Requisição inválida." }, { status: 400 });
        }
        const runId = request.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk", ...(runId ? { "X-Lovable-AIG-Run-ID": runId } : {}) },
        });
        const messages: ModelMessage[] = msgs.map((m) => ({ role: m.role, content: m.content }));
        let erro: string | undefined;
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          system: `${INSTRUCOES_COPILOT}\n\nCONTEXTO:\n${corpo.contexto}`,
          messages,
          abortSignal: request.signal,
          providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
          onError: ({ error }) => { console.error("copilot", error); erro = String((error as { message?: string })?.message ?? error); },
        });
        const enc = new TextEncoder();
        const body = new ReadableStream({
          async start(c) {
            try { for await (const t of result.textStream) c.enqueue(enc.encode(t)); } catch { /* reportado abaixo */ }
            if (erro) c.enqueue(enc.encode(`\n\n⚠️ Falha no Copilot: ${erro.slice(0, 200)}`));
            c.close();
          },
        });
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
