"use client";
import {useEffect,useEffectEvent} from "react";

export function useShareDialogFocus(active:boolean,onClose:()=>void,selector='.share-dialog[role="dialog"]'){
  const close=useEffectEvent(onClose);
  useEffect(()=>{
    if(!active)return;
    const root=[...document.querySelectorAll<HTMLElement>(selector)].at(-1);
    if(!root)return;
    const previous=document.activeElement as HTMLElement|null;
    const controls=()=>[...root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary')].filter(element=>element.getClientRects().length>0);
    if(!root.contains(document.activeElement))controls()[0]?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();close();return;}
      if(event.key!=="Tab")return;
      const items=controls(),index=items.indexOf(document.activeElement as HTMLElement);
      if(index<0||(event.shiftKey&&index===0)||(!event.shiftKey&&index===items.length-1)){
        event.preventDefault();items[event.shiftKey?items.length-1:0]?.focus();
      }
    };
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("keydown",key);previous?.focus({preventScroll:true});};
  },[active,selector]);
}
export {useShareDialogFocus as useDialogFocus};
