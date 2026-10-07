import type { AppSettings } from "./types";

export const AI_PROVIDERS = {
  gemini: { name: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", keyUrl: "https://aistudio.google.com/app/apikey", models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"] },
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/settings/keys", models: ["openai/gpt-5.6-luna", "google/gemini-3.6-flash", "anthropic/claude-sonnet-4.6"] },
  openai: { name: "OpenAI", base: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys", models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6"] },
  anthropic: { name: "Anthropic Claude", base: "https://api.anthropic.com/v1", keyUrl: "https://console.anthropic.com/settings/keys", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"] },
} as const;
export type AiImage = { mime: string; base64: string };
export type AiMessage = { role: "user" | "assistant"; text: string };

export function aiRetryDelay(response:Response, attempt:number, now=Date.now()):number {
  const value=response.headers.get("retry-after");
  if(value){const seconds=Number(value);const ms=Number.isFinite(seconds) ? seconds*1000 : Date.parse(value)-now;if(Number.isFinite(ms))return Math.max(0,ms);}
  return 1000*2**attempt+Math.floor(Math.random()*250);
}
function waitForRetry(ms:number,signal?:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException("Aborted","AbortError"));return;}const cancel=()=>{clearTimeout(timer);signal?.removeEventListener("abort",cancel);reject(new DOMException("Aborted","AbortError"));};const timer=setTimeout(()=>{signal?.removeEventListener("abort",cancel);resolve();},ms);signal?.addEventListener("abort",cancel,{once:true});});
}
async function fetchAiWithRetry(url:string,init:RequestInit,provider:AppSettings["aiProvider"],signal?:AbortSignal):Promise<Response>{
  for(let attempt=0;attempt<3;attempt++){
    if(signal?.aborted)throw new DOMException("Aborted","AbortError");
    const response=await fetch(url,{...init,signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000)});
    if(response.ok)return response;
    const retryable=[429,500,502,503,504].includes(response.status), delay=aiRetryDelay(response,attempt);
    await response.body?.cancel();
    if(retryable && attempt<2 && delay<=15_000){await waitForRetry(delay,signal);continue;}
    const name=AI_PROVIDERS[provider].name, status=response.status;
    if(status===503 || status===502 || status===504 || status===500)throw new Error(`${name} 服務暫時忙碌（HTTP ${status}），${attempt ? "已自動重試仍失敗，":""}請稍後再試或在設定選擇其他可用模型。原有資料不會被覆蓋。`);
    if(status===429)throw new Error(`${name} 請求次數或額度受限（HTTP 429），請稍後再試並檢查 API 額度。`);
    if(status===401 || status===403)throw new Error(`${name} API 金鑰或存取權限有問題（HTTP ${status}），請到設定確認。`);
    if(status===404)throw new Error(`${name} 找不到模型（HTTP 404），請在設定重新取得模型清單並選擇可用模型。`);
    throw new Error(`${name} API 回傳 HTTP ${status}`);
  }
  throw new Error("AI 連線失敗");
}

export async function requestAi(settings: AppSettings, system: string, messages: AiMessage[] = [], image?: AiImage, signal?: AbortSignal): Promise<string> {
  if (!settings.aiEnabled) throw new Error("AI 功能目前已關閉");
  if (!settings.usePersonalAiApi) throw new Error("Vocab Gateway 尚未部署，請使用自己的 API Key");
  const profiles = (settings.aiProfiles ?? []).filter(profile => profile.key.trim());
  // Prefer the selected provider, and only fail over to explicitly saved credentials.
  const choices = profiles.filter(profile => profile.provider === settings.aiProvider).concat(profiles.filter(profile => profile.provider !== settings.aiProvider));
  if (!choices.length && settings.aiApiKey) choices.push({ id: "legacy", provider: settings.aiProvider, model: settings.aiModel, key: settings.aiApiKey });
  if (!choices.length) throw new Error("請先到設定加入 AI API Key");
  let lastError: unknown;
  for (const profile of choices) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await requestAiCredential(profile.provider, profile.key, profile.provider === settings.aiProvider ? settings.aiModel : profile.model,
        profile.provider === settings.aiProvider ? settings.aiBaseUrl : AI_PROVIDERS[profile.provider].base, system, messages, image, signal);
    } catch (error) { if (signal?.aborted) throw error; lastError = error; }
  }
  throw lastError ?? new Error("AI 連線失敗");
}

export async function requestAiCredential(provider: AppSettings["aiProvider"], key: string, model: string, base: string, system: string, messages: AiMessage[] = [], image?: AiImage, signal?: AbortSignal): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string; let body: unknown;
  const history = messages.length ? messages : [{ role: "user" as const, text: "請依照上述指令回答。" }];
  if (provider === "gemini") {
    url = `${base.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent`;
    headers["x-goog-api-key"] = key;
    const contents = history.map((message, index) => ({ role: message.role === "assistant" ? "model" : "user", parts: [
      { text: message.text }, ...(image && index === history.length - 1 ? [{ inlineData: { mimeType: image.mime, data: image.base64 } }] : []),
    ] }));
    body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 } };
  } else if (provider === "anthropic") {
    url = `${base.replace(/\/$/, "")}/messages`;
    headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = { model, max_tokens: 8192, system, messages: history.map((message, index) => ({ role: message.role, content: [
      { type: "text", text: message.text }, ...(image && index === history.length - 1 ? [{ type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } }] : []),
    ] })) };
  } else {
    url = `${base.replace(/\/$/, "")}/chat/completions`; headers.Authorization = `Bearer ${key}`;
    body = { model, ...(provider === "openai" ? { max_completion_tokens: 8192 } : { max_tokens: 8192 }), response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...history.map((message, index) => ({ role: message.role,
      content: image && index === history.length - 1 ? [{ type: "text", text: message.text }, { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } }] : message.text,
    }))] };
  }
  const response = await fetchAiWithRetry(url, { method: "POST", headers, body: JSON.stringify(body) },provider,signal);
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[]; content?: { type: string; text: string }[]; choices?: { message?: { content?: string } }[] };
  const text = provider === "gemini" ? data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("")
    : provider === "anthropic" ? data.content?.filter((part: { type: string }) => part.type === "text").map((part: { text: string }) => part.text).join("")
    : data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI 沒有傳回內容");
  return text;
}

export async function fetchAiModels(settings: AppSettings): Promise<string[]> {
  const key = settings.aiProfiles?.find(profile => profile.provider === settings.aiProvider)?.key ?? settings.aiApiKey;
  if (!key) throw new Error("請先加入 API Key");
  const headers: Record<string, string> = settings.aiProvider === "gemini" ? { "x-goog-api-key": key } : settings.aiProvider === "anthropic"
    ? { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } : { Authorization: `Bearer ${key}` };
  const response = await fetch(`${settings.aiBaseUrl.replace(/\/$/, "")}/models`, { headers });
  if (!response.ok) throw new Error(`模型清單回傳 ${response.status}`);
  const data = await response.json() as { models?: { id?: string; name?: string }[]; data?: { id?: string; name?: string }[] };
  return (data.models ?? data.data ?? []).map((item: { id?: string; name?: string }) => item.id ?? item.name?.replace(/^models\//, "")).filter((id): id is string => typeof id === "string" && !!id);
}
