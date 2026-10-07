"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MdDeleteOutline, MdEdit, MdMoreVert, MdStarBorder, MdStar, MdVolumeUp } from "react-icons/md";
import type { Card } from "./types";

export function CardActionMenu({ card, onEdit, onFavorite, onDelete, onSpeak }: { card: Card; onEdit: () => void; onFavorite: () => void; onDelete: () => void; onSpeak: () => void }) {
  const [position,setPosition]=useState<{top:number;left:number}|null>(null), trigger=useRef<HTMLButtonElement>(null), menu=useRef<HTMLDivElement>(null);
  function close(focus=true) { setPosition(null); if (focus) trigger.current?.focus(); }
  useEffect(()=> {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({preventScroll:true});
    const outside=(event:PointerEvent)=>{ if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null); };
    // Ignore a queued scroll event from bringing the trigger into view before opening.
    const offsets=new Map<Element,{top:number;left:number}>([document.documentElement,...document.querySelectorAll(".sheet-body")].map(element=>[element,{top:element.scrollTop,left:element.scrollLeft}]));
    const scroll=(event:Event)=> { if(event.type==="resize") {setPosition(null);return;} const element=event.target===document ? document.documentElement : event.target as Element; const initial=offsets.get(element); if(!initial || element.scrollTop!==initial.top || element.scrollLeft!==initial.left)setPosition(null); };
    const keyboard=(event:KeyboardEvent)=> {
      if (event.key==="Escape" || event.key==="Tab") { setPosition(null); if(event.key==="Escape") trigger.current?.focus(); return; }
      if (!["ArrowDown","ArrowUp","Home","End"].includes(event.key)) return;
      event.preventDefault(); const controls=[...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')??[])], index=controls.indexOf(document.activeElement as HTMLButtonElement);
      controls[event.key==="Home" ? 0 : event.key==="End" ? controls.length-1 : (index+(event.key==="ArrowUp" ? -1 : 1)+controls.length)%controls.length]?.focus();
    };
    document.addEventListener("pointerdown",outside); document.addEventListener("keydown",keyboard); window.addEventListener("resize",scroll); document.addEventListener("scroll",scroll,true);
    return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);window.removeEventListener("resize",scroll);document.removeEventListener("scroll",scroll,true);};
  },[position]);
  const actions=[{label:card.favorite ? "取消收藏":"加入收藏",icon:card.favorite ? MdStar:MdStarBorder,action:onFavorite},{label:"編輯",icon:MdEdit,action:onEdit},{label:"發音",icon:MdVolumeUp,action:onSpeak},{label:"刪除",icon:MdDeleteOutline,action:onDelete,danger:true}];
  return <><button ref={trigger} className="icon-button" aria-label={`單字操作 ${card.word}`} aria-expanded={!!position} aria-haspopup="menu" onClick={()=> { if(position) {close();return;} const rect=trigger.current!.getBoundingClientRect(); setPosition({left:Math.max(12,Math.min(innerWidth-220-12,rect.right-220)),top:Math.max(12,Math.min(innerHeight-216-12,rect.bottom+4))}); }}><MdMoreVert size={24}/></button>
    {position && createPortal(<div ref={menu} role="menu" aria-label={`${card.word} 的操作`} className="card-action-menu" style={position}>{actions.map(({label,icon:Glyph,action,danger})=><button key={label} role="menuitem" className={danger ? "danger-text":""} onClick={()=>{close(false);action();}}><Glyph size={22}/><span>{label}</span></button>)}</div>,document.body)}
  </>;
}
