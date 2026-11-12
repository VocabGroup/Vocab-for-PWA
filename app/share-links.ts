import {parseFolderShare,type FolderShare} from "./folder-sharing";
export type PublishedShare={url:string;id:string;deleteToken:string;expiresAt:number};
export async function publishShare(share:FolderShare):Promise<PublishedShare>{
  const raw=JSON.stringify(share);if(new TextEncoder().encode(raw).length>512*1024)throw Error("網址分享上限 512 KB，請改用 JSON 檔案");
  const response=await fetch("/api/shares",{method:"POST",headers:{"Content-Type":"application/json"},body:raw,signal:AbortSignal.timeout(25000)});
  const value=await response.json() as Partial<PublishedShare>&{error?:string};if(!response.ok)throw Error(value.error||"分享未完成");
  if(!value.id||!/^[a-f0-9]{48}$/.test(value.id)||!value.deleteToken||!/^[a-f0-9]{48}$/.test(value.deleteToken)||value.url!==`${location.origin}/share#${value.id}`||typeof value.expiresAt!=="number")throw Error("分享服務回傳格式錯誤");
  return value as PublishedShare;
}
export async function readShare(url:string):Promise<FolderShare>{
  const target=new URL(url);if(target.origin!==location.origin||target.pathname!=="/share"||!/^[a-f0-9]{48}$/.test(target.hash.slice(1)))throw Error("請貼上此網站產生的 Vocab 分享網址");
  const response=await fetch(`/api/shares/${target.hash.slice(1)}`,{cache:"no-store",signal:AbortSignal.timeout(25000)});
  const value=await response.json() as {error?:string;share?:unknown};if(!response.ok)throw Error(value.error||"分享已到期或不存在");return parseFolderShare(JSON.stringify(value.share));
}
