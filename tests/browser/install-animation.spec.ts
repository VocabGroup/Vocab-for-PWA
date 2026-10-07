import { test, expect } from "@playwright/test";
test.use({serviceWorkers:"block"});

test("reference Safari menu, share sheet and home-screen form align with hand taps",async({page},info)=>{
  await page.goto("/install-preview");
  const phone=page.locator(".install-demo-phone");
  for(const [name,time,target,panel] of [
    ["browser",2.2,".demo-more-target",".install-demo-phone"],
    ["overflow",5.4,".demo-share-target",".demo-more-sheet"],
    ["share",9.6,".demo-home-target",".demo-share-sheet"],
    ["home",14,".demo-add-target",".demo-success"],
  ] as const){
    await phone.evaluate(async(element,time)=>{for(const animation of element.getAnimations({subtree:true})){animation.pause();animation.currentTime=time*1000;}await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));},time);
    const panelState=await page.locator(panel).evaluate(element=>({opacity:getComputedStyle(element).opacity,transform:getComputedStyle(element).transform}));
    expect(Number(panelState.opacity)).toBe(1);
    const hand=await page.locator(".demo-hand").boundingBox(),button=await page.locator(target).boundingBox();
    expect(hand).not.toBeNull();expect(button).not.toBeNull();
    const tip={x:hand!.x+hand!.width*37/80,y:hand!.y+hand!.height*7/100};
    expect(tip.x).toBeGreaterThanOrEqual(button!.x);expect(tip.x).toBeLessThanOrEqual(button!.x+button!.width);
    expect(tip.y).toBeGreaterThanOrEqual(button!.y);expect(tip.y).toBeLessThanOrEqual(button!.y+button!.height);
    await phone.screenshot({path:info.outputPath(`safari-${name}.png`)});
  }
  await expect(page.locator(".demo-webapp-target")).toContainText("打開為網頁 App");
});
