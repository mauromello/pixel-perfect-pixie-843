import type { Tables } from "@/integrations/supabase/types";

export type EntradaDicionario = Tables<"dicionario_dados">;
export const COLUNAS_DICIONARIO = ["grupo", "entidade", "variavel", "tipo", "unidade", "nivel_hierarquia", "sistema_origem", "periodicidade", "obrigatoria", "chave", "regra_critica", "descricao"] as const;
// Explicit inventory, never derived from runtime keys: new model fields must fail coverage tests.
type Campo = [variavel: string, tipo: string, descricao: string, unidade?: string, origem?: string, opcional?: boolean, chave?: boolean, critica?: string];
const itens: EntradaDicionario[] = [];
function entidade(nome: string, grupo: string, nivel: string, origem: string, periodicidade: string, campos: Campo[]) {
  for (const [variavel, tipo, descricao, unidade = "—", sistema = origem, opcional = false, chave = variavel === "id", critica = "Compatibilidade com o tipo e presença quando obrigatória."] of campos) itens.push({ grupo, entidade: nome, variavel, tipo, unidade, nivel_hierarquia: nivel, sistema_origem: sistema, periodicidade, obrigatoria: !opcional, chave, regra_critica: critica, descricao });
}
const id: Campo = ["id", "string", "Identificador estável do elemento; vínculo topológico, não código comercial."];
const nome: Campo = ["nome", "string", "Nome do elemento no modelo."];
const lat: Campo = ["lat", "number", "Latitude WGS84.", "grau", "GIS/BDGD", false, false, "Entre −90 e 90."];
const lng: Campo = ["lng", "number", "Longitude WGS84.", "grau", "GIS/BDGD", false, false, "Entre −180 e 180."];
const energia = (campo: string, desc: string, origem = "SCADA/SMF", opcional = false): Campo => [campo, "number", desc, "MWh", origem, opcional, false, "Valor finito; conferir período mensal e sentido do fluxo."];

entidade("Subestacao", "Inventário geoelétrico", "SE", "GIS/BDGD", "Sob alteração", [id, nome,
 ["regional", "string", "Regional agregada pelo nome; não existe tabela regional nem código regional separado."],
 ["municipio", "string", "Município agregado pelo nome; não existe cadastro IBGE no modelo."], lat, lng,
 ["tensaoATkV", "number", "Tensão de entrada AT da SE.", "kV"], ["tensaoMTkV", "number", "Tensão MT declarada da SE.", "kV"],
 energia("entradaAT", "Energia mensal na entrada AT."), energia("geracaoLocal", "Geração local convencional agregada na SE; sem cadastro de usina GC.", "SCADA/SMF / CCEE"), energia("servicoAuxiliar", "Consumo dos serviços auxiliares."),
 ["alvoPT", "number", "Meta regulatória PT demonstrativa.", "%", "SAP / parametrização"], ["alvoPNT", "number", "Meta regulatória PNT demonstrativa.", "%", "SAP / parametrização"],
 ["alimentadores", "Alimentador[]", "Relação hierárquica de alimentadores."], ["medidoresFronteira", "MedidorFronteira[]", "Leituras direcionais e extremos estáveis.", "—", "MDM / SCADA/SMF", true],
]);
entidade("Alimentador", "Inventário geoelétrico", "Alimentador", "GIS/BDGD", "Sob alteração", [id,
 ["cod", "string", "Código utilizado na associação do CSV PERTEC PLUS.", "—", "GIS/BDGD", false, true, "Código deve identificar um único alimentador na extração."],
 energia("entradaDisjuntor", "Energia líquida mensal do disjuntor."), energia("exportacaoFronteira", "Exportação mensal agregada fora do alimentador."),
 energia("usoInterno", "Consumo interno incluído na energia fornecida.", "CCS / SAP"), energia("iluminacaoPublica", "Energia mensal de iluminação pública.", "CCS"),
 ["condutor", "Condutor", "Parâmetros equivalentes do tronco MT."], ["tensaoKV", "number", "Tensão nominal; manobra exige igualdade entre alimentadores.", "kV"],
 ["ampacidade", "number", "Corrente máxima admitida na validação de manobras.", "A"], ["cor", "string", "Cor de identificação; metadado visual, não estado operacional.", "—", "Aplicação"],
 ["segmentos", "Segmento[]", "Trechos radiais ordenados."], ["trafos", "Trafo[]", "Transformadores MT/BT ligados ao alimentador."],
 ["parametrosPerda", "ParametrosPerda", "Fatores analíticos; ausente usa os valores padrão.", "—", "Aplicação", true],
 ["motorPT", '"analitico" | "importado"', "Motor de PT ativo; sem valor usa analítico.", "—", "Aplicação", true],
 energia("ptImportada", "PT total do CSV PERTEC PLUS; ausente usa analítico; rateio MT/BT é estimado.", "PERTEC PLUS", true),
]);
entidade("Condutor", "Inventário geoelétrico", "Alimentador / MT", "GIS/BDGD", "Sob alteração", [
 ["r", "number", "Resistência equivalente por quilômetro.", "Ω/km"], ["comprimento", "number", "Comprimento total equivalente.", "km"],
 ["corrente", "number", "Corrente do tronco preservada para ampacidade; fatores Fd/Fp só afetam perdas.", "A", "SCADA/SMF"],
]);
entidade("ParametrosPerda", "Perdas e metodologia", "Alimentador", "Aplicação", "Por cenário", [
 ["fd", "number", "Fator de distribuição de carga; padrão 1/3.", "p.u.", "Aplicação", false, false, "Finito entre 0 e 1."],
 ["coeficiente", "number", "a em Fp=a·FC+(1−a)·FC²; padrão 0,2.", "p.u.", "Aplicação", false, false, "Finito entre 0 e 1."],
 ["fc", "number", "Fator de carga MT/BT; padrão 0,6.", "p.u.", "Aplicação", false, false, "Finito entre 0 e 1."],
]);
entidade("Segmento", "Inventário geoelétrico", "Trecho MT", "GIS/BDGD", "Sob alteração", [id, ["cod", "string", "Código do trecho."],
 ["coords", "Coord[] ([number, number][])", "Polilinha WGS84 na ordem [latitude, longitude].", "grau"], ["comprimento", "number", "Extensão do trecho.", "km"],
]);
const camposChave: Campo[] = [id, ["cod", "string", "Código operacional da chave."],
 ["tipo", '"disjuntor" | "religador" | "seccionadora" | "fusivel"', "Categoria de Switch CIM."], lat, lng,
 ["normalAberta", "boolean", "Estado normal de abertura."], ["aberta", "boolean", "Estado atual de abertura.", "—", "ADMS / SCADA/SMF"],
 ["alimentadorId", "string", "Extremo A: referência ao Alimentador.id.", "—", "GIS/BDGD", false, false, "Referência existente."],
 ["segmentoId", "string", "Trecho do extremo A.", "—", "GIS/BDGD", false, false, "Pertence ao alimentador A."],
 ["alimentadorBId", "string | undefined", "Extremo B apenas para interligação.", "—", "GIS/BDGD", true], ["segmentoBId", "string | undefined", "Trecho do extremo B da interligação.", "—", "GIS/BDGD", true],
];
entidade("Chave", "Inventário geoelétrico", "Chave", "GIS/BDGD", "Sob alteração / evento", camposChave);
entidade("Religador", "Inventário geoelétrico", "Religador", "GIS/BDGD / ADMS", "Sob alteração / evento", camposChave.map(c => c[0] === "tipo" ? ["tipo", '"religador"', "Subtipo de Chave; não possui cadastro independente."] : c));
entidade("Trafo", "Inventário geoelétrico", "Trafo MT/BT", "GIS/BDGD", "Sob alteração", [id, nome,
 ["classe", "string | undefined", "Classe do trafo para faixa de instalações e fator de carga típico.", "—", "GIS/BDGD", true],
 ["p0", "number", "Perda em vazio do transformador.", "kW"], ["pcu", "number", "Perda nominal em cobre.", "kW"], ["srated", "number", "Potência nominal aparente.", "kVA"],
 ["segmentoId", "string", "Trecho ao qual o trafo está ligado.", "—", "GIS/BDGD", false, false, "Trecho existente no alimentador."], lat, lng,
 ["tensaoPrimKV", "number", "Tensão primária MT.", "kV", "GIS/BDGD", false, false, "Compatível com tensaoKV do alimentador."],
 ["tensaoSecV", "number", "Tensão secundária BT.", "V"], ["clientes", "Cliente[]", "Instalações de consumo/GD associadas."],
]);
const camposCliente: Campo[] = [id, nome, ["tipo", '"cativo" | "livre" | "gd"', "Classe do consumidor; GD mantém importação/exportação separadas.", "—", "CCS / CCEE"],
 ["trafoId", "string | null | undefined", "Vínculo explícito ao transformador MT/BT.", "—", "GIS/BDGD", true],
 ["medidor", "MedidorInstalacao | null | undefined", "Medidor identificado da instalação.", "—", "MDM / CCS", true],
 ["cargaKva", "number | undefined", "Carga aparente associada à instalação.", "kVA", "MDM / CCS", true],
 energia("importacao", "Registrador de consumo mensal; sem datas de ciclo faturado no modelo.", "CCS / MDM / CCEE"), energia("exportacao", "Registrador GD separado; nunca compensar com importacao.", "MDM / CCEE")];
entidade("Cliente", "Mercado e GD", "Instalação", "CCS / MDM", "Mensal", camposCliente);
entidade("Instalacao", "Mercado e GD", "Instalação", "CCS / MDM", "Mensal", camposCliente.map(c => [c[0], c[1], `${c[2]} Representada por Cliente; número de instalação separado ainda não existe.`, ...c.slice(3)] as Campo));
entidade("MedidorFronteira", "Medições de fronteira", "Fronteira geoelétrica", "MDM / SCADA/SMF / CCEE", "Mensal", [id, nome,
 ["origemId", "string", "Extremo de origem; ID estável ou exterior.", "—", "GIS/BDGD", false, false, "Diferente do destino; referência resolvível."],
 ["destinoId", "string", "Extremo de destino; ID estável ou exterior.", "—", "GIS/BDGD", false, false, "Diferente da origem; referência resolvível."],
 energia("energiaMWh", "Energia no sentido origem→destino; demo usa estimativa."), energia("reversaMWh", "Energia no sentido destino→origem; registrador separado."),
 ["fonte", '"medida" | "estimada"', "Proveniência da leitura; estimada não é homologada.", "—", "Aplicação", false, false, "Aceitar somente medida ou estimada."],
]);
entidade("RegistroManobra", "Manobras", "Alimentador / Chave", "ADMS (alvo; registro local demonstrativo)", "Por evento", [
 ["id", "number", "Identificador local em milissegundos; não ID do ADMS.", "—", "Aplicação", false, true],
 ["tie", "string", "Código da chave de interligação."], ["sec", "string", "Código da chave de corte."], ["origem", "string", "Código do alimentador de origem."], ["destino", "string", "Código do receptor."],
 ["segmentos", "number", "Quantidade de trechos transferidos.", "contagem"], ["trafos", "number", "Quantidade de trafos transferidos.", "contagem"],
 energia("energia", "Energia mensal transferida proporcionalmente ao consumo; ainda sem duração horária ADMS.", "Aplicação"),
 ["correnteDestino", "number", "Corrente após a manobra.", "A"], ["ampacidade", "number", "Limite de corrente do receptor.", "A"],
 ["quando", "string", "Data/hora local formatada pt-BR; não timestamp normalizado.", "—", "Aplicação"],
]);
entidade("Params", "Clima e projeção", "Cenário / Distribuidora", "Aplicação (cenários simulados)", "Por cenário", [
 ["basePt", "number", "PT percentual inicial.", "%"], ["basePnt", "number", "PNT percentual inicial.", "%"], ["horizonte", "number", "Horizonte da projeção.", "mês"],
 ["consumo", "number", "Variação de consumo.", "%", "CCS (alvo; parâmetro manual)"], ["gd", "number", "Acréscimo de GD.", "MW", "MDM / CCEE (alvo; parâmetro manual)"], ["gc", "number", "Geração convencional de cenário.", "MW", "SCADA/SMF / CCEE (alvo; parâmetro manual)"],
 ["fiscal", "number", "Intensidade da fiscalização.", "%", "SAP / CCS (alvo; parâmetro manual)"],
 ["temperatura", "number", "Variação térmica de cenário; não leitura diária nem API meteorológica.", "Δ°C", "INMET (alvo; parâmetro manual)"],
 ["tarifa", "number", "Variação tarifária de cenário.", "Δ%", "SAP (alvo; parâmetro manual)"], ["pib", "number", "Variação do PIB regional de cenário.", "Δ%", "Aplicação"],
]);
entidade("ProjecaoMes", "Clima e projeção", "Cenário / mês", "Motor de projeção", "Mensal no cenário", [["pt", "number", "PT projetada com rampa min(1,i/6); coeficientes simulados.", "%"], ["pnt", "number", "PNT projetada; coeficientes simulados.", "%"]]);
entidade("Impacto", "Clima e projeção", "Cenário", "Motor de sensibilidade", "Por cenário", [nome, ["delta", "string", "Amplitude formatada da perturbação ±delta."], ...["ptMenos", "ptMais", "pntMenos", "pntMais", "amplitude"].map(v => [v, "number", "Variação em pontos percentuais no cenário de sensibilidade.", "p.p."] as Campo)]);

// Required extraction entities absent from the application are honest gaps, never invented fields.
for (const [ent, nivel, origem, desc] of [
 ["Regional", "Regional", "GIS/BDGD", "Somente Subestacao.regional; sem entidade/código próprio."],
 ["Municipio", "Município", "GIS/BDGD", "Somente Subestacao.municipio; sem código IBGE próprio."],
 ["TrafoATMT", "Trafo AT/MT", "GIS/BDGD / SAP", "Não existe entidade Trafo AT/MT; tensões e perda AT agregadas na SE não a substituem."],
 ["ClimaDiario", "Município / estação", "INMET", "Não existe série meteorológica diária; Params.temperatura é manual."],
 ["UsinaGC", "Geração convencional", "SCADA/SMF / CCEE", "Não existe cadastro de usina; apenas Subestacao.geracaoLocal e Params.gc."],
] as const) entidade(ent, "Lacunas de extração", nivel, `${origem} (integração não implementada)`, "Não disponível", [["(não implementado)", "ausente", desc, "—", origem, true, false, "Lacuna: implementar antes de homologar a extração."]]);
entidade("Medidor", "Inventário geoelétrico", "Instalação", "MDM / CCS", "Sob alteração", [id, ["numero", "string", "Número identificador do medidor."], ["tecnologia", '"AMI" | "Convencional"', "Tecnologia de medição."], ["tipo", '"bidirecional" | "consumo"', "Tipo dos registradores de medição."]]);
entidade("serie_mensal", "Medições de fronteira", "Elemento / competência", "SCADA/SMF / MDM / CCS (demonstração)", "Mensal", [["elemento_id", "text", "ID estável do elemento no modelo.", "—", "Aplicação", false, true], ["competencia", "date", "Primeiro dia do mês de referência.", "mês", "Aplicação", false, true], ["energia_injetada", "double precision | null", "Energia injetada no mês.", "MWh", "SCADA/SMF", true], ["consumo_mwh", "double precision | null", "Energia consumida no mês.", "MWh", "CCS / MDM", true], ["carga_kva", "double precision | null", "Carga aparente do mês.", "kVA", "MDM", true], ["leitura_completa", "boolean", "Indica completude da leitura mensal."], ["demonstracao", "boolean", "Identifica dados fictícios."]]);
entidade("criticas_parametros", "Banco / metodologia", "Regra", "Parametrização administrativa", "Sob alteração", [["regra", "text", "Identificador estável da regra.", "—", "Aplicação", false, true], ["parametro", "text", "Nome do limiar.", "—", "Aplicação", false, true], ["valor", "double precision", "Valor ilustrativo editável do limiar."]]);

entidade("profiles", "Banco / acesso", "Usuário", "Lovable Cloud / cadastro", "Sob alteração", [
 ["id", "uuid", "Identificador do usuário autenticado.", "—", "Lovable Cloud", false, true],
 ["nome", "text", "Nome cadastrado; dado pessoal."], ["email", "text", "E-mail cadastrado; dado pessoal."], ["unidade", "text", "Unidade organizacional."],
 ["ativo", "boolean", "Bloqueio de acesso da conta."], ["ultimo_acesso", "timestamp with time zone", "Último acesso registrado.", "—", "Lovable Cloud", true], ["created_at", "timestamp with time zone", "Criação do perfil."],
]);
entidade("user_roles", "Banco / acesso", "Usuário / papel", "Lovable Cloud", "Sob alteração", [["id", "uuid", "ID da atribuição.", "—", "Lovable Cloud", false, true], ["user_id", "uuid", "Referência ao usuário."], ["role", "app_role (admin|operador|planejamento|consulta)", "Papel protegido; nunca armazenar em profiles."]]);
entidade("configuracao", "Banco / acesso", "Sistema", "Lovable Cloud", "Sob alteração", [["id", "integer", "ID singleton 1.", "—", "Lovable Cloud", false, true], ["exigir_login", "boolean", "Exigência global de autenticação."], ["updated_at", "timestamp with time zone", "Data da atualização."]]);
entidade("areas_subbalanco", "Banco / metodologia", "Área geoelétrica", "Lovable Cloud", "Ao salvar área", [["id", "uuid", "Identificador da área.", "—", "Lovable Cloud", false, true], ["nome", "text", "Nome da área."], ["descricao", "text", "Descrição da área."], ["elementos", "jsonb", "IDs de alimentadores/trafos/medidoresFronteira/chavesCorte."], ["usuario_id", "uuid", "Autor autenticado."], ["criado_em", "timestamp with time zone", "Criação da área."]]);
entidade("ElementosArea", "Perdas e metodologia", "Área geoelétrica", "Aplicação / areas_subbalanco.elementos", "Ao salvar área", [["alimentadores", "string[]", "IDs de alimentadores incluídos."], ["trafos", "string[]", "IDs explícitos; ausente inclui todos do alimentador.", "—", "Aplicação", true], ["medidoresFronteira", "string[]", "IDs das leituras que delimitam fluxos."], ["chavesCorte", "string[]", "IDs dos cortes radiais virtuais."]]);
entidade("dicionario_dados", "Banco / documentação", "Sistema", "Lovable Cloud / catálogo inicial", "Sob revisão administrativa", COLUNAS_DICIONARIO.map(v => [v, v === "obrigatoria" || v === "chave" ? "boolean" : "text", `Metadado de extração: ${v}.`, "—", "Lovable Cloud", false, v === "entidade" || v === "variavel"]));

export const DICIONARIO_SEED: EntradaDicionario[] = itens;
export function exportarDicionarioCSV(rows: EntradaDicionario[]) {
  const celula = (v: unknown) => {
    const s = typeof v === "boolean" ? String(v) : String(v ?? "");
    const seguro = /^[=+@\-\t\r]/.test(s) ? `'${s}` : s;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + COLUNAS_DICIONARIO.join(";") + '\r\n' + rows.map(r => COLUNAS_DICIONARIO.map(k => celula(r[k])).join(";")).join('\r\n');
}
export function filtrarDicionario(rows: EntradaDicionario[], grupo: string, busca: string) {
  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return rows.filter(r => (!grupo || r.grupo === grupo) && normalizar(COLUNAS_DICIONARIO.map(k => String(r[k])).join(" ")).includes(normalizar(busca)));
}