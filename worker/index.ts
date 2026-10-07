/** Cloudflare Worker entry point for Vocab PWA. */
import handler from "vinext/server/app-router-entry";
import { publicImportUrl, fetchPublicImport, boundedText, secureResponse } from "./security";

interface Env {
  ASSETS: Fetcher;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/import-url" && request.method === "POST") {
      const origin=request.headers.get("origin");
      if(origin && origin!==url.origin)return secureResponse(Response.json({error:"不允許跨網站匯入請求"},{status:403}));
      return secureResponse(await importPublicDeck(request));
    }

    if (url.pathname === "/_vinext/image" || url.pathname === "/_next/image") {
      // Vocab uses local static images; do not expose an unused image proxy.
      return secureResponse(new Response("Not found",{status:404}));
    }

    return secureResponse(await handler.fetch(request, env, ctx));
  },
};

type PublicCard = { word: string; definition: string; exampleSentence?: string; rank?: number };

async function importPublicDeck(request: Request) {
  try {
    if(!request.headers.get("content-type")?.includes("application/json"))throw new Error("請使用 JSON 匯入請求");
    const body = JSON.parse(await boundedText(new Response(request.body,{headers:request.headers}),8192)) as { url?: string };
    const target = publicImportUrl(String(body.url || ""));
    const response = await fetchPublicImport(target,request.signal);
    if (!response.ok) throw new Error(`網站回傳 HTTP ${response.status}`);
    const html = await boundedText(response,8_000_000);
    const scripts = [...html.matchAll(/<script[^>]*(?:type=["']application\/ld\+json["']|id=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/gi)].map(match => decodeHtml(match[1]));
    const ranked: PublicCard[] = []; const cards: PublicCard[] = []; const seen = new Set<string>();
    const clean = (value: unknown) => String(value ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/[ \t]+/g, " ").trim();
    const textOf = (value: unknown): string => {
      if (typeof value === "string" || typeof value === "number") return clean(value);
      if (!value || typeof value !== "object") return "";
      const object = value as Record<string, unknown>;
      for (const key of ["text", "plainText", "value", "content", "answer"]) if (typeof object[key] === "string" || typeof object[key] === "number") return clean(object[key]);
      return "";
    };
    const first = (object: Record<string, unknown>, keys: string[]) => { for (const key of keys) { const value = textOf(object[key]); if (value) return value; } return ""; };
    const add = (word: string, definition: string, exampleSentence = "", rank?: number) => {
      word = clean(word); definition = clean(definition); exampleSentence = clean(exampleSentence);
      if (!word || !definition || word === definition || word.length > 500) return;
      const key = word.toLocaleLowerCase(); if (seen.has(key)) return; seen.add(key);
      (rank == null ? cards : ranked).push({ word, definition, exampleSentence, rank });
    };
    const visited = new Set<object>();
    const walk = (value: unknown, depth = 0) => {
      if (value == null || depth > 45) return;
      if (typeof value === "string") { const trimmed = value.trim(); if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) try { walk(JSON.parse(trimmed), depth + 1); } catch {} return; }
      if (typeof value !== "object" || visited.has(value as object)) return; visited.add(value as object);
      if (!Array.isArray(value)) {
        const object = value as Record<string, unknown>;
        if (Array.isArray(object.cardSides)) {
          const side = (label: string) => { const item = object.cardSides as Array<Record<string, unknown>>; const found = item.find(entry => entry.label === label); return Array.isArray(found?.media) ? found.media.map(textOf).filter(Boolean).join("\n") : ""; };
          add(side("word"), side("definition"), "", Number(object.rank));
        }
        add(first(object, ["word", "term", "front", "question", "prompt"]), first(object, ["definition", "meaning", "back", "answer", "response", "description"]), first(object, ["exampleSentence", "example", "sentence"]));
      }
      Object.values(value as Record<string, unknown>).forEach(child => walk(child, depth + 1));
    };
    scripts.forEach(script => { try { walk(JSON.parse(script)); } catch {} });
    const output = ranked.length ? ranked.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)) : cards;
    if (!output.length) throw new Error("分享頁沒有公開卡片資料，或網站要求人機驗證");
    const title = clean(html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || target.hostname);
    return Response.json({ title, sourceName: target.hostname, cards: output.slice(0, 5000).map(card => ({word:card.word,definition:card.definition,exampleSentence:card.exampleSentence})) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "無法讀取分享頁" }, { status: 400 });
  }
}

function decodeHtml(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export default worker;
