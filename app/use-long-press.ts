"use client";
import {useEffect,useRef,type PointerEvent,type MouseEvent} from "react";
export function useLongPress(onHold:()=>void){
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),origin=useRef({x:0,y:0}),held=useRef(false);
 const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 return {onPointerDown:(e:PointerEvent)=>{if(e.button!==0)return;held.current=false;cancel();if((e.target as HTMLElement).closest(".word-drag,.collection-drag,.collection-more,.select-card,.icon-button,.selection-dot"))return;origin.current={x:e.clientX,y:e.clientY};timer.current=setTimeout(()=>{held.current=true;onHold();},500);},onPointerMove:(e:PointerEvent)=>{if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>10)cancel();},onPointerUp:cancel,onPointerCancel:cancel,onClickCapture:(e:MouseEvent)=>{if(held.current){e.preventDefault();e.stopPropagation();held.current=false;}},onContextMenu:(e:MouseEvent)=>{e.preventDefault();cancel();held.current=true;onHold();}};
}
