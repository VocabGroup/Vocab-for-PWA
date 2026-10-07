export function publicImportUrl(value:string):URL {
  const url=new URL(value);
  const hosts=["quizlet.com","brainscape.com","knowt.com","cram.com"];
  if(url.protocol!=="https:" || url.username || url.password || (url.port && url.port!=="443") || !hosts.some(host=>url.hostname===host || url.hostname.endsWith(`.${host}`))) throw new Error("只支援允許網站的 HTTPS 公開分享網址");
  return url;
}

export async function boundedText(response:Response,maxBytes:number):Promise<string>{
  if(Number(response.headers.get("content-length"))>maxBytes){await response.body?.cancel();throw new Error("內容超過大小限制");}
  if(!response.body)return "";
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try {while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();throw new Error("內容超過大小限制");}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(length);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(data);
}

export async function fetchPublicImport(url:URL,signal?:AbortSignal):Promise<Response>{
  let target=publicImportUrl(url.href);
  const timeout=AbortSignal.timeout(15_000), requestSignal=signal ? AbortSignal.any([signal,timeout]):timeout;
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetch(target,{signal:requestSignal,redirect:"manual",headers:{Accept:"text/html,application/xhtml+xml"}});
    if(![301,302,303,307,308].includes(response.status))return response;
    const location=response.headers.get("location");await response.body?.cancel();
    if(!location || redirects===3)throw new Error("分享頁重新導向過多或無效");
    target=publicImportUrl(new URL(location,target).href);
  }
  throw new Error("無法讀取分享頁");
}

export function secureResponse(response:Response):Response{
  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");headers.set("X-Frame-Options","DENY");headers.set("Referrer-Policy","no-referrer");
  headers.set("Permissions-Policy","camera=(self), microphone=(self), fullscreen=(self), geolocation=(), payment=()");
  headers.set("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
