import type { AppSettings } from "./types";

export const AI_PROVIDERS = {
  gemini: { name: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", keyUrl: "https://aistudio.google.com/app/apikey", models: ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"] },
  openrouter: { name: "OpenRouter", base: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/settings/keys", models: ["openai/gpt-5.6-luna", "google/gemini-3.6-flash", "anthropic/claude-sonnet-4.6"] },
  openai: { name: "OpenAI", base: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys", models: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5.6"] },
  anthropic: { name: "Anthropic Claude", base: "https://api.anthropic.com/v1", keyUrl: "https://console.anthropic.com/settings/keys", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"] },
} as const;
export type AiImage = { mime: string; base64: string };
export type AiMessage = { role: "user" | "assistant"; text: string };
export type AiOptions = { onText?: (text:string)=>void; timeoutMs?:number; maxTokens?:number };

export function partialReply(raw:string):string {
  const match=raw.match(/"reply"\s*:\s*"((?:\\[\s\S]|[^"\\])*)/);if(!match)return "";
  let value=match[1];if(value.endsWith("\\"))value=value.slice(0,-1);
  try{return JSON.parse(`"${value}"`);}catch{return "";}
}
export async function readAiStream(response:Response,provider:AppSettings["aiProvider"],onText:(text:string)=>void):Promise<string>{
  const reader=response.body?.getReader();if(!reader)throw Error("AI 回覆沒有資料串流");
  const decoder=new TextDecoder();let buffer="",text="",finished=false;
  function event(frame:string){
    const raw=frame.split("\n").filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n");if(!raw)return;if(raw==="[DONE]"){finished=true;return;}
    const data=JSON.parse(raw);if(data.error)throw Error(data.error.message||"AI 串流回傳錯誤");
    const reason=data.candidates?.[0]?.finishReason??data.choices?.[0]?.finish_reason??data.delta?.stop_reason;
    if(reason&&!["STOP","stop","end_turn","tool_use"].includes(reason))throw Error(`AI 回覆未完成（${reason}），請減少每次內容；已顯示文字僅為草稿。`);
    if(reason||data.type==="message_stop")finished=true;
    const delta=provider==="gemini"?(data.candidates?.[0]?.content?.parts??[]).filter((part:{thought?:boolean})=>!part.thought).map((part:{text?:string})=>part.text??"").join(""):provider==="anthropic"?(data.type==="content_block_delta"?data.delta?.text??"":""):data.choices?.[0]?.delta?.content??"";
    text+=delta;if(text.length>2_000_000)throw Error("AI 回覆過長，已停止接收");if(delta)onText(text);
  }
  try{while(true){const result=await reader.read();buffer+=decoder.decode(result.value,{stream:!result.done});buffer=buffer.replaceAll("\r\n","\n");let index;while((index=buffer.indexOf("\n\n"))>=0){event(buffer.slice(0,index));buffer=buffer.slice(index+2);}if(result.done)break;}if(buffer.trim())event(buffer);if(!finished)throw Error("AI 回覆中途斷線；已顯示文字未經完整驗證，未執行任何資料修改。");if(!text.trim())throw Error("AI 沒有傳回內容");return text;}finally{await reader.cancel().catch(()=>{});}
}

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
    let response:Response;
    try {response=await fetch(url,{...init,signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000)});}
    catch(error){
      if(signal?.aborted)throw error;
      // Do not automatically resend a timed-out generation: the provider may have
      // completed it and charged the user even though the response was lost.
      if(error instanceof Error && error.name==="TimeoutError")throw new Error(`${AI_PROVIDERS[provider].name} 回應逾時，請稍後再試。原有資料不會被覆蓋。`);
      throw new Error(`${AI_PROVIDERS[provider].name} 連線失敗，請確認網路與 API 網址，或稍後再試。原有資料不會被覆蓋。`);
    }
    if(response.ok)return response;
    const retryable=[429,500,502,503,504].includes(response.status), delay=aiRetryDelay(response,attempt);
    await response.body?.cancel();
    if(retryable && attempt<2 && delay<=15_000){await waitForRetry(delay,signal);continue;}
    const name=AI_PROVIDERS[provider].name, status=response.status;
    if(status===503 || status===502 || status===504 || status===500)throw new Error(`${name} 服務暫時忙碌（HTTP ${status}），${attempt ? "已自動重試仍失敗，":""}請稍後再試或在設定選擇其他可用模型。原有資料不會被覆蓋。`);
    if(status===429)throw new Error(`${name} 請求次數或額度受限（HTTP 429），請稍後再試並檢查 API 額度。`);
    if(status===401 || status===403)throw new Error(`${name} API 金鑰或存取權限有問題（HTTP ${status}），請到設定確認。`);
    if(status===404)throw new Error(`${name} 找不到模型（HTTP 404），請在設定重新取得模型清單並選擇可用模型。`);
    if(status===400)throw new Error(`${name} 不接受這次請求（HTTP 400）；圖片辨識請確認模型支援圖片、圖片格式為 JPEG／PNG，PDF 請使用 Gemini。原圖與成功結果已保留。`);
    throw new Error(`${name} API 回傳 HTTP ${status}`);
  }
  throw new Error("AI 連線失敗");
}

export async function requestAi(settings: AppSettings, system: string, messages: AiMessage[] = [], image?: AiImage, signal?: AbortSignal, options:AiOptions = {}): Promise<string> {
  if (!settings.aiEnabled) throw new Error("AI 功能目前已關閉");
  if (!settings.usePersonalAiApi) throw new Error("Vocab Gateway 尚未部署，請使用自己的 API Key");
  const profiles = (settings.aiProfiles ?? []).filter(profile => profile.key.trim());
  // Prefer the selected provider, and only fail over to explicitly saved credentials.
  const choices = profiles.filter(profile => profile.provider === settings.aiProvider).concat(profiles.filter(profile => profile.provider !== settings.aiProvider));
  if (!choices.length && settings.aiApiKey) choices.push({ id: "legacy", provider: settings.aiProvider, model: settings.aiModel, key: settings.aiApiKey });
  if (!choices.length) throw new Error("請先到設定加入 AI API Key");
  let lastError: unknown;
  const deadline=AbortSignal.timeout(options.timeoutMs??120_000);
  const bounded=signal?AbortSignal.any([signal,deadline]):deadline;
  for (const profile of choices) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await requestAiCredential(profile.provider, profile.key, profile.provider === settings.aiProvider ? settings.aiModel : profile.model,
        profile.provider === settings.aiProvider ? settings.aiBaseUrl : AI_PROVIDERS[profile.provider].base, system, messages, image, bounded, options);
    } catch (error) { if (signal?.aborted) throw new DOMException("Aborted","AbortError");if(deadline.aborted)throw Error("AI 作業已達整體時間上限，請重試；未自動重送，原有資料保留。");lastError = error;if(!/HTTP (401|403|404)/.test((error as Error).message))throw error; }
  }
  throw lastError ?? new Error("AI 連線失敗");
}

export async function requestAiCredential(provider: AppSettings["aiProvider"], key: string, model: string, base: string, system: string, messages: AiMessage[] = [], image?: AiImage, signal?: AbortSignal, options:AiOptions = {}): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url: string; let body: unknown;
  const history = messages.length ? messages : [{ role: "user" as const, text: "請依照上述指令回答。" }];
  const tokens=options.maxTokens??(image?8192:4096), streaming=!!options.onText;
  if (provider === "gemini") {
    url = `${base.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:${streaming?"streamGenerateContent?alt=sse":"generateContent"}`;
    headers["x-goog-api-key"] = key;
    const contents = history.map((message, index) => ({ role: message.role === "assistant" ? "model" : "user", parts: [
      { text: message.text }, ...(image && index === history.length - 1 ? [{ inlineData: { mimeType: image.mime, data: image.base64 } }] : []),
    ] }));
    body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { responseMimeType: "application/json", maxOutputTokens: tokens } };
  } else if (provider === "anthropic") {
    url = `${base.replace(/\/$/, "")}/messages`;
    headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = { model, max_tokens: tokens, ...(streaming?{stream:true}:{}), system, messages: history.map((message, index) => ({ role: message.role, content: [
      { type: "text", text: message.text }, ...(image && index === history.length - 1 ? [{ type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } }] : []),
    ] })) };
  } else {
    url = `${base.replace(/\/$/, "")}/chat/completions`; headers.Authorization = `Bearer ${key}`;
    body = { model, ...(provider === "openai" ? { max_completion_tokens: tokens } : { max_tokens: tokens }), ...(streaming?{stream:true}:{}), response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...history.map((message, index) => ({ role: message.role,
      content: image && index === history.length - 1 ? [{ type: "text", text: message.text }, { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } }] : message.text,
    }))] };
  }
  const response = await fetchAiWithRetry(url, { method: "POST", headers, body: JSON.stringify(body) },provider,signal);
  if(streaming&&response.headers.get("content-type")?.includes("text/event-stream"))return readAiStream(response,provider,options.onText!);
  const data = await response.json() as { candidates?: { finishReason?:string; content?: { parts?: { text?: string;thought?:boolean }[] } }[]; stop_reason?:string; content?: { type: string; text: string }[]; choices?: {finish_reason?:string; message?: { content?: string } }[] };
  const finish=data.candidates?.[0]?.finishReason??data.choices?.[0]?.finish_reason??data.stop_reason;
  if(finish&&!["STOP","stop","end_turn"].includes(finish))throw Error(`AI 回覆未完成（${finish}），請減少每次內容；原圖與已完成結果保留。`);
  const text = provider === "gemini" ? data.candidates?.[0]?.content?.parts?.filter(part=>!part.thought).map((part: { text?: string }) => part.text ?? "").join("")
    : provider === "anthropic" ? data.content?.filter((part: { type: string }) => part.type === "text").map((part: { text: string }) => part.text).join("")
    : data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI 沒有傳回內容");
  options.onText?.(text);
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
