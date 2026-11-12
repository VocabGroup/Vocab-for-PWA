import { parseFolderShare } from "../app/folder-sharing";
import { boundedText } from "./security";

export interface ShareEnv { VOCAB_SHARES?: KVNamespace; SHARE_RATE_SALT?: string }
const TTL = 7 * 86400;
const MAX_BYTES = 512 * 1024;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const token = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const digest = async (text: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));

export async function shareRequest(request: Request, env: ShareEnv): Promise<Response> {
  const url = new URL(request.url), kv = env.VOCAB_SHARES;
  if (!kv || !env.SHARE_RATE_SALT) return reply({error:"分享服務尚未設定，請先使用 JSON 檔案分享"}, 503);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return reply({error:"不允許跨網站請求"}, 403);
  try {
    if (url.pathname === "/api/shares" && request.method === "POST") {
      if (!request.headers.get("content-type")?.includes("application/json")) return reply({error:"請使用 JSON"}, 415);
      const ip = request.headers.get("cf-connecting-ip");
      // Fail closed rather than accepting unmetered production writes.
      if (!ip) return reply({error:"無法確認分享請求來源"}, 403);
      const day = new Date().toISOString().slice(0,10);
      const ipKey = `rate:${day}:${await digest(env.SHARE_RATE_SALT + ip)}`, globalKey = `rate:${day}:global`;
      const count = Number(await kv.get(ipKey) || 0), globalCount = Number(await kv.get(globalKey) || 0);
      // KV counters are best-effort, NOT atomic distributed rate limiting.
      if (count >= 5 || globalCount >= 200) return reply({error:"今日分享額度已滿，請改用 JSON 檔案"}, 429);
      const share = parseFolderShare(await boundedText(new Response(request.body,{headers:request.headers}),MAX_BYTES));
      if (share.decks.length > 50 || share.decks.reduce((n,d)=>n+d.cards.length,0)>5000) return reply({error:"網址分享上限為 50 個資料夾、5,000 字；較大教材請分享檔案"},413);
      const id = token(), deleteToken = token(), expiresAt = Date.now()+TTL*1000;
      // Reserve quota before writing payload. Failures never return a broken URL.
      await kv.put(ipKey,String(count+1),{expirationTtl:172800});
      await kv.put(globalKey,String(globalCount+1),{expirationTtl:172800});
      await kv.put(`share:${id}`, JSON.stringify({share,expiresAt,deleteHash:await digest(deleteToken)}), {expirationTtl:TTL});
      return reply({url:`${url.origin}/share#${id}`,id,deleteToken,expiresAt},201);
    }
    const id = url.pathname.match(/^\/api\/shares\/([a-f0-9]{48})$/)?.[1];
    if (!id) return reply({error:"找不到分享"},404);
    const raw = await kv.get(`share:${id}`);
    if (!raw) return reply({error:"分享已到期、已撤銷或不存在"},404);
    const value = JSON.parse(raw);
    if (value.expiresAt <= Date.now()) return reply({error:"分享已到期"},410);
    if (request.method === "GET") return reply({share:value.share,expiresAt:value.expiresAt});
    if (request.method === "DELETE") {
      const credential = request.headers.get("authorization")?.replace(/^Bearer /,"") || "";
      if (!/^[a-f0-9]{48}$/.test(credential) || await digest(credential) !== value.deleteHash) return reply({error:"無法撤銷分享"},403);
      await kv.delete(`share:${id}`); return reply({deleted:true});
    }
    return reply({error:"不支援的操作"},405);
  } catch {
    return reply({error:"分享未完成：請檢查檔案格式、大小或稍後重試；原教材不受影響"},400);
  }
}
