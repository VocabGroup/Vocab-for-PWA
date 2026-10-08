import { lookupDictionary, type LookupEntry, type LookupSource } from "./dictionary-lookup";

async function serverLookup(query: string, source: LookupSource, signal?: AbortSignal): Promise<LookupEntry> {
  const response=await fetch(`/api/dictionary?source=${encodeURIComponent(source)}&q=${encodeURIComponent(query)}`,{signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),cache:"no-store"});
  const payload=await response.json() as {entry?:LookupEntry;error?:string};
  if(!response.ok || !payload.entry)throw new Error(payload.error || "字典沒有回傳結果");
  return payload.entry;
}

/** Google/Free are CORS-capable public endpoints. Avoid shared data-center IP restrictions.
 * Cambridge remains server-side: do not use an untrusted proxy or bypass its challenge. */
export async function lookupBrowserDictionary(query: string, source: string, signal?: AbortSignal): Promise<LookupEntry> {
  signal?.throwIfAborted();
  query=query.trim();
  if(!query || query.length>80 || !/^[a-zA-Z\u3400-\u9fff\s'’-]+$/.test(query))throw new Error("請輸入 80 字內的英文單字、短語或中文解釋");
  if(!["AUTO","GOOGLE","CAMBRIDGE","FREE"].includes(source))throw new Error("此來源尚未支援，請選擇 Google、劍橋或 Free Dictionary");
  if(source==="CAMBRIDGE")return serverLookup(query,"CAMBRIDGE",signal);
  const providers: LookupSource[]=source==="AUTO" ? /[\u3400-\u9fff]/.test(query) ? ["GOOGLE"] : ["GOOGLE","FREE","CAMBRIDGE"] : [source as LookupSource];
  const failures: string[]=[];
  for(const provider of providers){
    try {return provider==="CAMBRIDGE" ? await serverLookup(query,provider,signal) : await lookupDictionary(query,provider,signal);}
    catch(error){if(signal?.aborted)throw error;failures.push(error instanceof Error ? error.message : "查詢失敗");}
  }
  throw new Error(`${failures.join("；")}。可開啟下方原網站；本機單字仍可使用。`);
}
