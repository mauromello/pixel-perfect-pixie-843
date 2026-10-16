// Conteúdo bilíngue do guia/apresentação: uso + fundamentação técnica.
export type L = { pt: string; en: string };
export type SlideGuia = {
  id: string;
  rota?: string;
  titulo: L;
  resumo: L;
  uso: L[];
  tecnico: L[];
  formulas?: { f: string; d: L }[];
};

const l = (pt: string, en: string): L => ({ pt, en });

export const SLIDES: SlideGuia[] = [
  {
    id: "visao",
    titulo: l("PerdaZero — Visão Geral", "PerdaZero — Overview"),
    resumo: l("Plataforma de balanço energético e combate a perdas técnicas e não técnicas em redes de distribuição.", "Energy balance and technical / non-technical loss management platform for distribution grids."),
    uso: [
      l("Use o menu lateral para navegar entre os módulos; o que aparece depende do seu perfil.", "Use the side menu to move between modules; what you see depends on your profile."),
      l("Troque o idioma (PT/EN) no rodapé do menu a qualquer momento.", "Switch language (PT/EN) at the bottom of the menu at any time."),
      l("Todas as telas leem o mesmo modelo de rede: uma edição aparece em todo o sistema.", "Every screen reads the same network model: an edit shows up everywhere."),
    ],
    tecnico: [
      l("Aplicação full-stack React (TanStack Start) com backend gerenciado (banco PostgreSQL + autenticação).", "Full-stack React app (TanStack Start) with managed backend (PostgreSQL + authentication)."),
      l("Estado único da rede em um store reativo; os motores de cálculo são funções puras e testadas.", "Single reactive network store; calculation engines are pure, unit-tested functions."),
      l("Separação: modelo (CIM) → motores (balanço, manobra, temáticos, sensibilidade, analytics) → telas.", "Layering: model (CIM) → engines (balance, switching, thematic, sensitivity, analytics) → screens."),
    ],
  },
  {
    id: "modelo",
    rota: "/rede",
    titulo: l("Modelo de Rede CIM e Importação BDGD", "CIM Network Model & BDGD Import"),
    resumo: l("Um único modelo Subestação → Alimentador → Trecho/Trafo → Cliente, mais chaves.", "One single model Substation → Feeder → Segment/Transformer → Customer, plus switches."),
    uso: [
      l("Em Gestão do Modelo de Rede, expanda a árvore e edite qualquer valor (condutor, kVA, consumo, metas).", "In Network Model Management, expand the tree and edit any value (conductor, kVA, consumption, targets)."),
      l("Importe a BDGD da ANEEL em GeoJSON ou exporte o modelo em CIM-XML/GeoJSON.", "Import ANEEL's BDGD as GeoJSON or export the model as CIM-XML/GeoJSON."),
      l("As alterações ficam no navegador: exporte antes de recarregar a página.", "Changes live in the browser: export before reloading the page."),
    ],
    tecnico: [
      l("Mapeamento IEC 61970/61968: SUB→Substation, CTMT→Feeder, SSDMT→ACLineSegment, UNTRMT→PowerTransformer, UNSEMT→Switch, UCBT→EnergyConsumer.", "IEC 61970/61968 mapping: SUB→Substation, CTMT→Feeder, SSDMT→ACLineSegment, UNTRMT→PowerTransformer, UNSEMT→Switch, UCBT→EnergyConsumer."),
      l("Topologia montada por conectividade de nós (PAC_1/PAC_2), ordenando os trechos a partir da saída do alimentador.", "Topology built from node connectivity (PAC_1/PAC_2), ordering segments from the feeder head."),
      l("Clientes ligados aos trafos por UNI_TR_MT; níveis de tensão AT/MT/BT segregados.", "Customers linked to transformers via UNI_TR_MT; HV/MV/LV voltage levels kept separate."),
    ],
  },
  {
    id: "balanco",
    rota: "/",
    titulo: l("Balanço Energético", "Energy Balance"),
    resumo: l("Perdas totais, técnicas e não técnicas por alimentador, subestação e nível de tensão.", "Total, technical and non-technical losses per feeder, substation and voltage level."),
    uso: [
      l("A tela inicial mostra os indicadores gerais e a tabela por alimentador comparada às metas.", "The home screen shows overall indicators and the per-feeder table against targets."),
      l("Gere o Relatório de Resultados para imprimir/PDF ou baixar em CSV.", "Generate the Results Report to print/PDF or download as CSV."),
    ],
    tecnico: [
      l("Geração distribuída: exportação e importação são lidas separadamente e nunca compensadas entre si.", "Distributed generation: export and import are read separately and never netted."),
      l("PNT é obtida por diferença; perdas AT vêm das sobras da subestação.", "NTL is derived by difference; HV losses come from the substation residual."),
    ],
    formulas: [
      { f: "E_liq = E_entrada + GD_inj − E_export_fronteira", d: l("Energia injetada líquida", "Net injected energy") },
      { f: "P_total = E_liq − E_fornecida", d: l("Perda total", "Total loss") },
      { f: "P_MT = 3 · R · I² · Δt · Fp", d: l("Perda técnica em trechos de média tensão (Fp = fator de perdas)", "MV segment technical loss (Fp = loss factor)") },
      { f: "P_trafo = (P0 + Pcu · FC²) · Δt", d: l("Perda em vazio + cobre do transformador (FC = fator de carga)", "Transformer no-load + copper loss (FC = load factor)") },
      { f: "PNT = P_total − P_técnica", d: l("Perda não técnica", "Non-technical loss") },
    ],
  },
  {
    id: "manobras",
    rota: "/manobras",
    titulo: l("Simulação de Manobras", "Switching Simulation"),
    resumo: l("Transferência de carga entre alimentadores validada pelo modelo de rede.", "Load transfer between feeders validated by the network model."),
    uso: [
      l("Escolha uma chave de interligação (NA) para fechar e uma seccionadora para abrir.", "Pick a normally-open tie switch to close and a sectionalizer to open."),
      l("Veja a carga transferida (kW/MW) e o novo balanço; desfaça as manobras quando quiser.", "See transferred load (kW/MW) and the new balance; undo switching at any time."),
    ],
    tecnico: [
      l("Validações: tie normalmente aberta, seccionadora fechada, mesma tensão (13,8 / 23 / 34,5 kV), sem laços, ampacidade respeitada.", "Checks: tie normally open, sectionalizer closed, same voltage (13.8 / 23 / 34.5 kV), no loops, ampacity respected."),
      l("Busca em grafo a partir da seccionadora identifica trechos, trafos e clientes a jusante, que mudam de alimentador.", "Graph search from the sectionalizer finds downstream segments, transformers and customers, which change feeder."),
      l("Carga transferida proporcional ao kVA dos trafos e consumo dos clientes; um snapshot permite o desfazer.", "Transferred load is proportional to transformer kVA and customer consumption; a snapshot enables undo."),
    ],
    formulas: [{ f: "I_nova = I_destino + I_transferida ≤ I_nominal", d: l("Restrição de ampacidade do condutor", "Conductor ampacity constraint") }],
  },
  {
    id: "mapas",
    rota: "/mapas",
    titulo: l("Mapas Geoespaciais e Temáticos", "Geospatial & Thematic Maps"),
    resumo: l("O mapa desenha apenas o que existe no modelo de rede, com simbologia e estado operacional.", "The map draws only what exists in the network model, with symbology and operating state."),
    uso: [
      l("No painel lateral: troque o mapa base (Padrão, Satélite, Noturno, Claro) e filtre camadas AT/MT/BT.", "In the side panel: switch base map (Standard, Satellite, Dark, Light) and filter HV/MV/LV layers."),
      l("Aba Temas: perdas técnicas, PNT, inadimplência, fraude, clandestinas; clique numa área crítica para dar zoom.", "Themes tab: technical losses, NTL, default, fraud, illegal connections; click a critical area to zoom."),
      l("Aba Polígono: desenhe uma área e conte clientes, trafos, GD e kVA.", "Polygon tab: draw an area and count customers, transformers, DG and kVA."),
    ],
    tecnico: [
      l("Norma COS: vermelho = fechado/energizado, verde = aberto, cinza = desenergizado; símbolos ABNT/CIM.", "COS convention: red = closed/energized, green = open, grey = de-energized; ABNT/CIM symbols."),
      l("Desenergização propagada: seccionadora aberta corta o trecho e jusante; disjuntor de saída corta o alimentador.", "De-energization propagation: an open sectionalizer cuts its segment and downstream; the head breaker cuts the feeder."),
      l("Indicadores por trafo: PT = (P0 + Pcu·FC²)·730 h; PNT rateada pelo consumo; áreas de risco agregadas por hexágono.", "Per-transformer indicators: TL = (P0 + Pcu·LF²)·730 h; NTL allocated by consumption; risk areas aggregated by hexagon."),
    ],
  },
  {
    id: "metodologia",
    rota: "/metodologia",
    titulo: l("Metodologia e Gap Regulatório", "Methodology & Regulatory Gap"),
    resumo: l("Três motores de cálculo, sub-balanços geoelétricos e exposição tarifária.", "Three calculation engines, geo-electric sub-balances and tariff exposure."),
    uso: [
      l("Escolha o motor: Analítico (PRODIST 7), Parametrizado (%) ou Regulatório (PRORET 2.6).", "Choose the engine: Analytical (PRODIST 7), Parametrized (%) or Regulatory (PRORET 2.6)."),
      l("Monte sub-balanços selecionando alimentadores e confira a estanqueidade da fronteira.", "Build sub-balances by selecting feeders and check boundary tightness."),
      l("Informe a tarifa para ver o gap real × meta em MWh, pontos percentuais e R$.", "Enter the tariff to see the actual × target gap in MWh, percentage points and BRL."),
    ],
    tecnico: [
      l("Sub-balanço: metade das trocas de fronteira com alimentadores vizinhos da mesma SE é tratada como interna.", "Sub-balance: half of the boundary exchanges with neighbouring feeders of the same substation is treated as internal."),
      l("Exposição financeira afeta a Parcela B quando a perda real supera a regulatória.", "Financial exposure hits Parcel B when actual loss exceeds the regulatory one."),
    ],
    formulas: [
      { f: "Gap = P_real − P_meta", d: l("Gap regulatório (MWh ou p.p.)", "Regulatory gap (MWh or p.p.)") },
      { f: "Exposição (R$) = max(0, Gap) × Tarifa", d: l("Exposição tarifária", "Tariff exposure") },
    ],
  },
  {
    id: "auditoria",
    rota: "/metodologia",
    titulo: l("Medições e Auditoria de Dados", "Metering & Data Audit"),
    resumo: l("Seis camadas de medição e oito regras automáticas de crítica.", "Six metering layers and eight automatic validation rules."),
    uso: [
      l("Na aba Medições, acompanhe a saúde de cada camada: Bruta → Coletada → Validada → Ajustada → CCEE → Faturada.", "In the Metering tab, follow each layer's health: Raw → Collected → Validated → Adjusted → CCEE → Billed."),
      l("Revise os achados de auditoria por severidade antes de fechar o balanço.", "Review audit findings by severity before closing the balance."),
    ],
    tecnico: [
      l("Regras: completude de fronteira, alinhamento temporal, consistência topológica, sentido de fluxo da GD.", "Rules: boundary completeness, time alignment, topological consistency, DG flow direction."),
      l("Regras: multiplicadores TC/TP, integração ACL, não compensação de GD, degrau histórico.", "Rules: CT/VT multipliers, free-market (ACL) integration, no DG netting, historical step change."),
      l("Limites atuais (desvio >35%, degrau 20–35%) são provisórios até receber os valores oficiais.", "Current thresholds (>35% deviation, 20–35% step) are provisional until official values arrive."),
    ],
  },
  {
    id: "ia",
    rota: "/ia",
    titulo: l("IA, ML e Analytics", "AI, ML & Analytics"),
    resumo: l("Scoring de fraude/PNT, detecção de anomalias e priorização de inspeções.", "Fraud/NTL scoring, anomaly detection and inspection prioritization."),
    uso: [
      l("Filtre por subestação e score mínimo; a matriz lista os alvos priorizados.", "Filter by substation and minimum score; the matrix lists prioritized targets."),
      l("Acompanhe assertividade (precisão/recall), energia recuperável e anomalias de carga.", "Track accuracy (precision/recall), recoverable energy and load anomalies."),
    ],
    tecnico: [
      l("Score derivado dos indicadores temáticos de cada trafo (PNT, inadimplência, fraude, clandestinas).", "Score derived from each transformer's thematic indicators (NTL, default, fraud, illegal connections)."),
      l("Anomalias por desvio estatístico (z-score) da curva de carga.", "Anomalies via statistical deviation (z-score) of the load curve."),
      l("Pesos e resultados de inspeção são simulados; devem ser trocados pelos dados reais de campo.", "Weights and inspection outcomes are simulated; they must be replaced with real field data."),
    ],
    formulas: [
      { f: "z = (x − μ) / σ", d: l("Desvio padronizado do consumo", "Standardized consumption deviation") },
      { f: "Precisão = VP/(VP+FP) · Recall = VP/(VP+FN)", d: l("Assertividade do modelo", "Model accuracy") },
    ],
  },
  {
    id: "projecao",
    rota: "/projecao",
    titulo: l("Projeção e Sensibilidade", "Projection & Sensitivity"),
    resumo: l("Cenários futuros de perdas com sete variáveis e ranking de sensibilidade.", "Future loss scenarios with seven variables and a sensitivity ranking."),
    uso: [
      l("Ajuste os controles: consumo, GD, Geração Convencional, fiscalização, temperatura, tarifa e PIB.", "Adjust the controls: consumption, DG, Conventional Generation, enforcement, temperature, tariff and GDP."),
      l("O gráfico de sensibilidade mostra qual variável mais move as perdas.", "The sensitivity chart shows which variable moves losses the most."),
    ],
    tecnico: [
      l("Cada efeito entra em rampa linear e atinge 100% em 6 meses: f = min(1, i/6).", "Each effect ramps linearly, reaching 100% in 6 months: f = min(1, i/6)."),
      l("GD reduz PT até certa penetração e passa a elevá-la com fluxo reverso; calor eleva PT; tarifa alta e PIB baixo elevam PNT.", "DG lowers TL up to a penetration level, then raises it via reverse flow; heat raises TL; high tariff and low GDP raise NTL."),
      l("Sensibilidade: cada variável vai ao mínimo e ao máximo; ranking pela amplitude Δ na perda total.", "Sensitivity: each variable is swept to min and max; ranked by Δ amplitude in total loss."),
    ],
    formulas: [{ f: "R(T) = R0 · [1 + α (T − T0)]", d: l("Resistência do condutor com a temperatura", "Conductor resistance vs temperature") }],
  },
  {
    id: "seguranca",
    rota: "/admin",
    titulo: l("Segurança, Perfis e Configuração", "Security, Profiles & Settings"),
    resumo: l("Controle de acesso por perfil e chave de login obrigatório.", "Profile-based access control and a required-login switch."),
    uso: [
      l("Perfis: Administrador, Operador, Planejamento e Consulta; cada um vê só suas telas.", "Profiles: Administrator, Operator, Planning and Inquiry; each sees only its screens."),
      l("Em Configurações, o administrador gerencia usuários e liga/desliga a exigência de login.", "In Settings, the administrator manages users and turns required login on/off."),
    ],
    tecnico: [
      l("Perfis guardados em tabela própria, separada do cadastro, impedindo autopromoção.", "Roles stored in their own table, separate from the profile, preventing self-promotion."),
      l("Regras de segurança em nível de linha no banco; o primeiro cadastro vira administrador.", "Row-level security in the database; the first sign-up becomes administrator."),
      l("Com login desligado, visitantes recebem uma sessão de avaliador com acesso completo.", "With login off, visitors get an evaluator session with full access."),
    ],
  },
];
