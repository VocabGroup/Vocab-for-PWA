import { test, expect } from "@playwright/test";
test.use({serviceWorkers:"block"});
const safari="Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
async function fixture(context:import("@playwright/test").BrowserContext,ua:string,fullscreen=false,installed=false){
  await context.addInitScript(({ua,fullscreen,installed})=>{
    Object.defineProperty(navigator,"userAgent",{value:ua});Object.defineProperty(navigator,"standalone",{value:installed});
    Object.defineProperty(document,"fullscreenEnabled",{value:fullscreen,configurable:true});
    const tracked=window as Window & {fullscreenCalls?:number};tracked.fullscreenCalls=0;
    Element.prototype.requestFullscreen=async()=>{tracked.fullscreenCalls=(tracked.fullscreenCalls ?? 0)+1;};
    if(!localStorage.getItem("entry-fixture")){localStorage.setItem("entry-fixture","yes");localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light"}}));}
  },{ua,fullscreen,installed});
}
test("Android release choice, synchronous fullscreen and saved launch preference",async({page,context},info)=>{
  await fixture(context,"Mozilla/5.0 (Linux; Android 15) Chrome/130 Mobile",true);
  await page.goto("/");await expect(page.getByRole("heading",{name:"選擇適合你的 Vocab"})).toBeVisible();
  await expect(page.getByRole("link",{name:"前往 GitHub 安裝安卓版"})).toHaveAttribute("href","https://github.com/VocabGroup/Vocab-for-Android/releases");
  await page.screenshot({path:info.outputPath("android-entry.png")});
  await page.getByRole("button",{name:"繼續使用網頁版",exact:true}).click();
  expect(await page.evaluate(()=>(window as Window & {fullscreenCalls?:number}).fullscreenCalls)).toBe(1);
  await expect(page.getByRole("heading",{name:"Vocab",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("dialog",{name:"全螢幕開啟"})).toBeVisible();
  expect(await page.evaluate(()=>(window as Window & {fullscreenCalls?:number}).fullscreenCalls)).toBe(0);
  await page.getByRole("button",{name:"這次先用視窗模式"}).click();
  await page.getByRole("button",{name:"設定",exact:true}).click();await page.getByRole("button",{name:"外觀",exact:true}).click();
  const toggle=page.getByRole("switch",{name:"每次開啟時使用全螢幕"});await expect(toggle).toHaveAttribute("aria-checked","true");await toggle.click();
  await page.reload();await expect(page.getByRole("heading",{name:"Vocab",exact:true})).toBeVisible();await expect(page.getByRole("dialog",{name:"全螢幕開啟"})).toHaveCount(0);
});
test("iPhone non-Safari recommends Safari but browser continuation remains available",async({page,context})=>{
  await fixture(context,safari.replace("Version/26.0","CriOS/140.0"));await page.goto("/");
  await expect(page.getByRole("heading",{name:"請使用 Safari 開啟並安裝"})).toBeVisible();await expect(page.getByRole("button",{name:"複製網址，在 Safari 開啟"})).toBeVisible();
  await page.getByRole("button",{name:"繼續使用瀏覽器",exact:true}).click();await expect(page.getByRole("heading",{name:"Vocab",exact:true})).toBeVisible();
  await expect(page.getByRole("status")).toContainText("不支援網頁全螢幕");await page.reload();await expect(page.getByRole("heading",{name:"請使用 Safari 開啟並安裝"})).toHaveCount(0);
});
test("Safari phone and hand teaching loops; reduced motion, pause and standalone bypass",async({page,context},info)=>{
  await fixture(context,safari);await page.goto("/");await expect(page.getByRole("heading",{name:"把 Vocab 加入主畫面"})).toBeVisible();
  await expect(page.locator(".install-demo-phone")).toBeVisible();await expect(page.locator(".demo-hand")).toBeVisible();
  expect(await page.locator(".demo-hand").evaluate(element=>getComputedStyle(element).animationIterationCount)).toBe("infinite");
  await page.waitForTimeout(2400);await page.screenshot({path:info.outputPath("safari-install-demo.png")});
  await page.getByRole("button",{name:"暫停教學動畫"}).click();expect(await page.locator(".demo-hand").evaluate(element=>getComputedStyle(element).animationPlayState)).toBe("paused");
  await page.emulateMedia({reducedMotion:"reduce"});await expect(page.locator(".demo-hand")).toBeHidden();
  await page.getByRole("button",{name:"繼續使用瀏覽器",exact:true}).click();await expect(page.getByRole("heading",{name:"Vocab",exact:true})).toBeVisible();
});
test("installed home-screen app skips browser guide and fullscreen prompt",async({page,context})=>{
  await fixture(context,safari,true,true);await page.goto("/");await expect(page.getByRole("heading",{name:"Vocab",exact:true})).toBeVisible();await expect(page.locator(".browser-entry")).toHaveCount(0);await expect(page.locator(".fullscreen-launch")).toHaveCount(0);
});
test("503 retries complete AI fields without overwriting original sentence",async({page,context})=>{
  await context.addInitScript(()=>{localStorage.setItem("vocab-web-entry-v1","browser");Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true});});
  await context.addInitScript(()=>{if(localStorage.getItem("retry-fixture"))return;localStorage.setItem("retry-fixture","yes");localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",order:0}],cards:[{id:"c1",deckId:"d1",word:"persist",definition:"堅持",exampleSentence:"We persist.",exampleTranslation:"",order:0}],logs:[],quizRecords:[],settings:{onboardingDone:true,aiEnabled:true,usePersonalAiApi:true,aiProvider:"gemini",aiApiKey:"fixture-key",aiModel:"gemini-3.6-flash"}}));});
  let calls=0;await page.route("https://generativelanguage.googleapis.com/**",route=>{calls++;return calls<3 ? route.fulfill({status:503,headers:{"retry-after":"0"},json:{error:{message:"busy"}}}) : route.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({cards:[{word:"persist",definition:"另一定義",phonetic:"/p/",partOfSpeech:"v.",exampleSentence:"We persist.",exampleTranslation:"我們堅持。"}]})}]}}]}});});
  await page.goto("/");await page.getByRole("navigation").getByRole("button",{name:"資料夾",exact:true}).click();await page.getByRole("article",{name:"第一課"}).locator(".collection-main").click();await page.locator(".card-content").click();
  await page.getByRole("button",{name:"AI 一鍵補齊",exact:true}).click();await expect(page.getByRole("textbox",{name:"中文翻譯",exact:true})).toHaveValue("我們堅持。");await expect(page.getByRole("textbox",{name:"繁體中文定義",exact:true})).toHaveValue("堅持");expect(calls).toBe(3);
});
