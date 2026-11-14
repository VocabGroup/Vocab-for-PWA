"use client";
import {useEffect,useEffectEvent,useRef,type RefObject} from "react";
import {createPortal} from "react-dom";
import type {IconType} from "react-icons";
import {placeMenu,visibleBounds} from "./viewport";
export type MenuAction={label:string;action:()=>void;disabled?:boolean;danger?:boolean;icon?:IconType};
export function ActionMenu({anchor,trigger,label,actions,onClose,className="card-action-menu"}:{anchor:DOMRect;trigger:RefObject<HTMLButtonElement|null>;label:string;actions:MenuAction[];onClose:(restore?:boolean)=>void;className?:string}){
  const menu=useRef<HTMLDivElement>(null),close=useEffectEvent(onClose);
  useEffect(()=>{
    const element=menu.current;
    element?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({preventScroll:true});
    const offsets=new Map<Element,number>([document.documentElement,...document.querySelectorAll(".sheet-body,.page")].map(item=>[item,item.scrollTop]));
    const outside=(event:PointerEvent)=>{if(!element?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close(false);};
    const resize=()=>close(false);
    const scroll=(event:Event)=>{const target=event.target===document?document.documentElement:event.target as Element;if(element?.contains(target))return;if(!offsets.has(target)||target.scrollTop!==offsets.get(target))close(false);};
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();close(true);return;}
      if(event.key==="Tab"){close(false);return;}
      if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
      event.preventDefault();const items=[...(element?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')??[])];if(!items.length)return;
      const index=items.indexOf(document.activeElement as HTMLButtonElement);items[event.key==="Home"?0:event.key==="End"?items.length-1:(index+(event.key==="ArrowUp"?-1:1)+items.length)%items.length]?.focus();
    };
    document.addEventListener("pointerdown",outside);document.addEventListener("keydown",keyboard);document.addEventListener("scroll",scroll,true);window.addEventListener("resize",resize);window.visualViewport?.addEventListener("resize",resize);window.visualViewport?.addEventListener("scroll",resize);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",keyboard);document.removeEventListener("scroll",scroll,true);window.removeEventListener("resize",resize);window.visualViewport?.removeEventListener("resize",resize);window.visualViewport?.removeEventListener("scroll",resize);};
  },[trigger]);
  return createPortal(<div ref={menu} role="menu" aria-label={label} className={className} style={{...placeMenu(anchor,visibleBounds(),220,actions.length*48+16),position:"fixed",right:"auto",overflowY:"auto",zIndex:100}}>{actions.map(({label,action,disabled,danger,icon:Glyph})=><button key={label} role="menuitem" disabled={disabled} className={danger?"danger-text":""} onClick={()=>{onClose(false);action();}}>{Glyph&&<Glyph size={22}/>}<span>{label}</span></button>)}</div>,document.body);
}
