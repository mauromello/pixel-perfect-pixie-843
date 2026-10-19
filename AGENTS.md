<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Energy-balance business rules live only in `src/lib/calculationEngine.ts` (pure, tested); UI reads network data from the zustand store in `src/lib/network-store.ts` so edits propagate across screens.
- Initial-screen aggregation uses pure `balancoNo`/`serieBalancoNo`: aggregate feeder accounting once, report upstream substation losses separately for additive regional KPIs, and require complete stored history rather than fabricate chart months.
- CEMIG monthly market/CCEE transformations live in pure `regrasCemig.ts`; the store applies feeder results only for the active competence and the balance engine consumes them. Manual inputs and revision ledgers are session-scoped until dedicated market/CCEE persistence is implemented; never claim live external acquisition.
- Analytical factors and active imported feeder PT are applied through the shared store to feeder model fields; the pure engine consumes them so balance and switching retain a single source of truth. Imported feeder totals use analytical MT/BT proportions for level and partial-area allocation, not measured level losses.
- PERTEC PLUS CSV validation lives in the pure Methodology module and imports replace the previous dataset atomically, so malformed files cannot partially update feeder losses.
- Extraction metadata is maintained explicitly in `src/lib/dicionarioSeed.ts` and read from `dicionario_dados`, never from mock arrays; absent model entities are documented as gaps rather than invented schemas. Dictionary queries are session-keyed under the client-only authenticated layout and paginated to avoid truncation.
- The network model is CIM-shaped (Subestacao → Alimentador → Segmento/Trafo → Cliente, plus `chaves`) and is the single source for map, switching and balance; switching must go through `manobrar()` in the engine so topology validation stays in one place.
- BDGD (ANEEL) GeoJSON import and CIM-XML/GeoJSON export live in `src/lib/bdgd.ts` (pure, tested) so file formats stay decoupled from the store.
- All app screens live under `src/routes/_authenticated/` (client-only gate that loads the session, blocks inactive users and checks the screen's area); `/login` is the only public page.
- Access per profile comes from `src/lib/permissoes.ts` (pure, tested) and roles are stored in the `user_roles` table, never on profiles, to avoid privilege escalation.
- Thematic map indicators (Anexo II items 30/33) are derived in `src/lib/tematicos.ts` (pure, tested) from the network model so map themes stay consistent with the balance.
- Loss projection and multivariate sensitivity (Anexo II items 19/31) live in `src/lib/sensibilidade.ts` (pure, tested); the projection screen only renders it.
- UI translation uses `src/lib/i18n.ts` (`useT()`), keyed by the Portuguese text with fallback to Portuguese, so untranslated screens keep working while coverage grows.
- Login requirement is a global flag in the `configuracao` table (anon-readable, admin-only update) read by the `_authenticated` gate via `src/lib/configAcesso.ts`; when off, visitors get a full-access evaluator session so evaluators need no account.
- AI analytics scoring, precision/recall and anomaly detection live in `src/lib/analytics.ts` (pure, tested), derived from `tematicos` indicators so analytics stays tied to the network model.
- Geo-electric area calculations live in the pure, tested `src/lib/metodologia.ts`; boundary meters belong to the shared substation model, with directional readings and stable endpoint IDs, so area boundaries follow the same network after switching.
- Per-element dated monthly readings are stored in `serie_mensal`; `auditar()` delegates temporal and installation checks to pure `auditoriaTemporal.ts`, with shared database thresholds and real-ID hierarchy in `historico.ts`. Missing historical data is never substituted with generated readings on page load.
- Saved geo-electric areas use the browser's generated database client and database-enforced role policies; evaluator sessions cannot persist areas because they are not authenticated database users.
