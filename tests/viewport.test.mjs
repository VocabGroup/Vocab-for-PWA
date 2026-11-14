import test from "node:test";
import assert from "node:assert/strict";
import {loadSource} from "./load-source.mjs";
const {placeMenu}=loadSource("app/viewport.ts");
test("menus fit the visible keyboard viewport, flip upward and keep a scrollable height",()=>{
 for(const view of [{top:70,left:0,width:320,height:340},{top:0,left:30,width:260,height:180},{top:0,left:0,width:844,height:390}]){
  for(const anchor of [{top:10,bottom:58,right:50},{top:600,bottom:648,right:900}]){
   const p=placeMenu(anchor,view,220,310);assert.ok(p.top>=view.top+12);assert.ok(p.top+p.maxHeight<=view.top+view.height-12);assert.ok(p.left>=view.left+12);assert.ok(p.left+p.width<=view.left+view.width-12);
  }
 }
 const p=placeMenu({top:600,bottom:648,right:350},{top:0,left:0,width:390,height:700},220,208);assert.ok(p.top<600);
});
