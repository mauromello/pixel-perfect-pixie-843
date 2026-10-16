import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { definirExigeLogin, exigeLogin } from "@/lib/configAcesso";

export function ControleLogin() {
  const [exige, setExige] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    exigeLogin().then(setExige);
  }, []);

  async function alternar(v: boolean) {
    setMsg(null);
    const erro = await definirExigeLogin(v);
    if (erro) return setMsg(erro);
    setExige(v);
  }

  return (
    <div className="panel xl:col-span-2">
      <div className="panel-h">Controle de Acesso ao Sistema</div>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <div className="font-medium">Exigir login para acessar o sistema</div>
          <div className="text-sm text-muted-foreground">
            {exige === null
              ? "Carregando…"
              : exige
                ? "Acesso restrito — login obrigatório."
                : "Modo de avaliação ativo — qualquer pessoa acessa sem login, com acesso completo."}
          </div>
          {msg && <div className="mt-1 text-sm text-destructive">{msg}</div>}
        </div>
        <Switch checked={!!exige} disabled={exige === null} onCheckedChange={alternar} aria-label="Exigir login" />
      </div>
    </div>
  );
}
