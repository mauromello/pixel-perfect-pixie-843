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
- The network model is CIM-shaped (Subestacao → Alimentador → Segmento/Trafo → Cliente, plus `chaves`) and is the single source for map, switching and balance; switching must go through `manobrar()` in the engine so topology validation stays in one place.
- BDGD (ANEEL) GeoJSON import and CIM-XML/GeoJSON export live in `src/lib/bdgd.ts` (pure, tested) so file formats stay decoupled from the store.
- All app screens live under `src/routes/_authenticated/` (client-only gate that loads the session, blocks inactive users and checks the screen's area); `/login` is the only public page.
- Access per profile comes from `src/lib/permissoes.ts` (pure, tested) and roles are stored in the `user_roles` table, never on profiles, to avoid privilege escalation.
- Thematic map indicators (Anexo II items 30/33) are derived in `src/lib/tematicos.ts` (pure, tested) from the network model so map themes stay consistent with the balance.
- Loss projection and multivariate sensitivity (Anexo II items 19/31) live in `src/lib/sensibilidade.ts` (pure, tested); the projection screen only renders it.
