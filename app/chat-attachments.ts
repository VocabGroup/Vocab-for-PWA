import {prepareAiFile} from "./image-preparation";
import type {AiImage} from "./ai-client";
export type ChatAttachment={id:string;file:File;url?:string};
export type SentAttachment={name:string;mime:string;preview?:string};
export function acceptedChatFile(file:File):boolean{return file.type.startsWith("image/")||file.type==="application/pdf"||/\.(pdf|txt|md|csv|json)$/i.test(file.name)||file.type.startsWith("text/");}
export async function prepareChatAttachments(files:ChatAttachment[],signal:AbortSignal,onProgress:(detail:string)=>void){
 const media:AiImage[]=[],sent:SentAttachment[]=[],text:string[]=[];let size=0;
 for(const [index,{file}] of files.entries()){
  signal.throwIfAborted();onProgress(`正在準備附件 ${index+1} / ${files.length}：${file.name}`);
  if(!acceptedChatFile(file))throw Error(`不支援「${file.name}」，請使用圖片、PDF、TXT、Markdown、CSV 或 JSON。`);
  if(file.type.startsWith("text/")||/\.(txt|md|csv|json)$/i.test(file.name)){if(file.size>1024*1024)throw Error("文字文件請小於 1 MB");const content=await file.text();text.push(`附件名稱：${file.name}\n${content}`);if(text.join("\n").length>80_000)throw Error("附件文字超過 80,000 字元，請拆成較小的文件");sent.push({name:file.name,mime:file.type||"text/plain"});continue;}
  const normalized=/\.pdf$/i.test(file.name)&&file.type!=="application/pdf"?new File([file],file.name,{type:"application/pdf"}):file;
  const prepared=await prepareAiFile(normalized);signal.throwIfAborted();size+=prepared.size;if(size>18*1024*1024)throw Error("圖片與 PDF 合計超過 18 MB，請減少檔案後重試");
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("附件讀取失敗"));reader.onabort=()=>reject(new DOMException("Aborted","AbortError"));reader.readAsDataURL(prepared);});signal.throwIfAborted();media.push({mime:prepared.type,base64:data.split(",")[1]});
  let preview:string|undefined;if(prepared.type.startsWith("image/")){const img=new Image();img.src=data;await img.decode();const scale=Math.min(1,200/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d")?.drawImage(img,0,0,canvas.width,canvas.height);preview=canvas.toDataURL("image/jpeg",.7);canvas.width=canvas.height=1;}
  sent.push({name:file.name,mime:prepared.type,...(preview&&preview.length<=80_000?{preview}:{})});
 }
 signal.throwIfAborted();return {media,sent,text:text.join("\n\n")};
}
