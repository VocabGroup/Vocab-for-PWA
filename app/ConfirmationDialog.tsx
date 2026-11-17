"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {MdClose} from "react-icons/md";
import {useDialogFocus} from "./use-share-dialog-focus";
type Request={message:string;resolve:(value:boolean)=>void;handled:boolean};
export function confirmAction(message:string):Promise<boolean>{return new Promise(resolve=>{if(typeof window==="undefined"){resolve(false);return;}const request:Request={message,resolve,handled:false};window.dispatchEvent(new CustomEvent("vocab-confirm-action",{detail:request}));if(!request.handled)resolve(false);});}
export function ConfirmationDialog(){
 const pending=useRef<Request[]>([]),[queue,setQueue]=useState<Request[]>([]);
 useEffect(()=>{const receive=(event:Event)=>{const request=(event as CustomEvent<Request>).detail;if(!request||typeof request.message!=="string"||typeof request.resolve!=="function")return;request.handled=true;pending.current.push(request);setQueue([...pending.current]);};window.addEventListener("vocab-confirm-action",receive);return()=>{window.removeEventListener("vocab-confirm-action",receive);for(const request of pending.current)request.resolve(false);pending.current=[];};},[]);
 const finish=(value:boolean)=>{const request=pending.current.shift();setQueue([...pending.current]);request?.resolve(value);};
 useDialogFocus(!!queue.length,()=>finish(false),".confirmation-dialog");
 if(!queue.length)return null;
 return createPortal(<div className="nested-dialog-backdrop confirmation-backdrop"><section className="nested-dialog confirmation-dialog" role="dialog" aria-modal="true" aria-label="確認操作"><header><h3>確認操作</h3><button className="icon-button" aria-label="關閉" onClick={()=>finish(false)}><MdClose/></button></header><p>{queue[0].message}</p><div className="dialog-actions"><button className="secondary" onClick={()=>finish(false)}>取消</button><button className="primary" onClick={()=>finish(true)}>確認</button></div></section></div>,document.body);
}
