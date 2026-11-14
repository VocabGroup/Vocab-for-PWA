export type VisibleBounds={top:number;left:number;width:number;height:number};
export function visibleBounds():VisibleBounds {
  const css=getComputedStyle(document.documentElement),view=window.visualViewport;
  const height=parseFloat(css.getPropertyValue("--visible-height"));
  const top=parseFloat(css.getPropertyValue("--visible-top"));
  return {top:Number.isFinite(top)?top:view?.offsetTop??0,left:view?.offsetLeft??0,width:view?.width??innerWidth,height:Number.isFinite(height)?Math.min(height,innerHeight):view?.height??innerHeight};
}
export function placeMenu(anchor:{top:number;bottom:number;right:number},view:VisibleBounds,width:number,height:number){
  const margin=12,available=Math.max(1,view.height-margin*2),maxHeight=Math.min(height,available);
  const actualWidth=Math.min(width,Math.max(1,view.width-margin*2));
  const below=anchor.bottom+4,above=anchor.top-maxHeight-4;
  const top=below+maxHeight<=view.top+view.height-margin?below:above>=view.top+margin?above:Math.max(view.top+margin,Math.min(below,view.top+view.height-margin-maxHeight));
  return {top:Math.max(view.top+margin,Math.min(top,view.top+view.height-margin-maxHeight)),left:Math.max(view.left+margin,Math.min(anchor.right-actualWidth,view.left+view.width-margin-actualWidth)),width:actualWidth,maxHeight};
}
