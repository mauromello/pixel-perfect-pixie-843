import { useEffect } from "react";
import { traduzir, useIdioma } from "@/lib/i18n";

// Translates every visible text and placeholder/title/aria-label on screen,
// so screens written in Portuguese follow the chosen language without per-file wiring.
const ATTRS = ["placeholder", "title", "aria-label"] as const;

export function TraducaoTela() {
  const idioma = useIdioma((s) => s.idioma);

  useEffect(() => {
    const original = new WeakMap<Node, string>();
    const aplicado = new WeakMap<Node, string>();
    const attrOrig = new WeakMap<Element, Record<string, string>>();

    function texto(n: Text) {
      const atual = n.nodeValue ?? "";
      if (aplicado.get(n) !== atual) original.set(n, atual); // React wrote new text
      const base = original.get(n) ?? atual;
      const novo = traduzir(idioma, base);
      aplicado.set(n, novo);
      if (novo !== atual) n.nodeValue = novo;
    }
    function elem(el: Element) {
      let o = attrOrig.get(el);
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v == null) continue;
        if (!o) { o = {}; attrOrig.set(el, o); }
        const ap = o["__" + a];
        if (ap !== v) o[a] = v;
        const novo = traduzir(idioma, o[a] ?? v);
        o["__" + a] = novo;
        if (novo !== v) el.setAttribute(a, novo);
      }
    }
    function varrer(raiz: Node) {
      if (raiz.nodeType === Node.TEXT_NODE) return texto(raiz as Text);
      if (raiz.nodeType !== Node.ELEMENT_NODE) return;
      const el = raiz as Element;
      if (el.closest("script,style,.leaflet-tile-pane")) return;
      elem(el);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let n: Node | null = w.nextNode();
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) {
          const p = n.parentElement;
          if (p && p.tagName !== "SCRIPT" && p.tagName !== "STYLE") texto(n as Text);
        } else elem(n as Element);
        n = w.nextNode();
      }
    }

    varrer(document.body);
    if (document.title) document.title = traduzir(idioma, document.title);
    const obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") texto(m.target as Text);
        else if (m.type === "attributes") elem(m.target as Element);
        else m.addedNodes.forEach(varrer);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    document.documentElement.lang = idioma;
    return () => {
      obs.disconnect();
      // Restore Portuguese originals so the next language starts from them.
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null = w.nextNode();
      while (n) {
        const o = original.get(n);
        if (o !== undefined && aplicado.get(n) === n.nodeValue) n.nodeValue = o;
        n = w.nextNode();
      }
      document.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
        const o = attrOrig.get(el);
        if (o) for (const a of ATTRS) if (o[a] !== undefined && el.getAttribute(a) === o["__" + a]) el.setAttribute(a, o[a]);
      });
    };
  }, [idioma]);

  return null;
}
