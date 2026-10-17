import {test,expect,type Page} from "@playwright/test";
import {readFile} from "node:fs/promises";
test.use({serviceWorkers:"block"});
test.beforeEach(async({context})=>{
  await context.addInitScript(()=>{
    if(localStorage.getItem("sharing-test-seeded"))return;localStorage.setItem("sharing-test-seeded","yes");
    localStorage.setItem("vocab-web-entry-v1","browser");Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false});
    localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",description:"說明",color:"#426B63",order:0}],cards:[{id:"c1",deckId:"d1",word:"persist",definition:"持續",notes:"PRIVATE-NOTE",mastered:true,favorite:true,mistakeCount:8,intervalDays:30,nextReviewAt:100,order:0}],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light",fullscreenOnLaunch:false,aiEnabled:true,usePersonalAiApi:true,aiProvider:"gemini",aiApiKey:"TEST-ONLY-NOT-A-SECRET",aiModel:"test",aiBaseUrl:"https://generativelanguage.googleapis.com/v1beta"}}));
  });
});
async function deviceState(page:Page){return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("vocab-device-data",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const raw=await new Promise<string>((resolve,reject)=>{const tx=db.transaction("snapshots","readonly"),r=tx.objectStore("snapshots").get("state");tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);});db.close();return JSON.parse(raw);
});}
test("single-folder sharing, private fields excluded, cross-device import resets learning and undo preserves original",async({page})=>{
 await page.goto("/");await page.getByRole("navigation").getByRole("button",{name:"資料夾",exact:true}).click();
 await page.getByRole("button",{name:"更多操作 第一課"}).click();await page.getByRole("menuitem",{name:"分享資料夾"}).click();
 const downloadEvent=page.waitForEvent("download");await page.getByRole("button",{name:"分享／下載 JSON"}).click();const download=await downloadEvent;const raw=await readFile((await download.path())!,"utf8");expect(raw).not.toContain("PRIVATE-NOTE");expect(raw).not.toContain("TEST-ONLY");expect(raw).not.toContain("mastered");
 await page.locator('.folder-sharing input[type="file"]').setInputFiles({name:"friend.vocab-share.json",mimeType:"application/json",buffer:Buffer.from(raw)});
 const dialog=page.getByRole("dialog",{name:"匯入分享資料夾"});await expect(dialog).toContainText("已有 1 字");await dialog.getByRole("button",{name:"確認匯入所選資料夾"}).click();
 await expect.poll(async()=> (await deviceState(page)).decks.length).toBe(2);const state=await deviceState(page);const imported=state.cards.find((c:{id:string})=>c.id!=="c1");expect(imported.mastered).toBe(false);expect(imported.intervalDays).toBe(0);expect(imported.mistakeCount).toBe(0);expect(state.cards.find((c:{id:string})=>c.id==="c1").mastered).toBe(true);
 page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"撤回這次匯入",exact:true}).click();await expect.poll(async()=> (await deviceState(page)).decks.length).toBe(1);expect((await deviceState(page)).cards[0].id).toBe("c1");
});
test("image multi-select compresses to JPEG, retains successful page, retries only failure and permits editing selection",async({page})=>{
 let calls=0;const prompts:string[]=[];await page.route("https://generativelanguage.googleapis.com/**",async route=>{
  if(route.request().method()==="OPTIONS"){await route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"}});return;}
  calls++;const body=route.request().postDataJSON();prompts.push(body.systemInstruction.parts[0].text);expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/jpeg");
  if(calls===2){await route.fulfill({status:400,body:"unsupported image"});return;}
  await route.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({cards:[{word:calls===1?"apple":"study",definition:calls===1?"蘋果":"學習"}]})}]},finishReason:"STOP"}]}});
 });
 await page.goto("/");await page.getByRole("button",{name:"掃描匯入",exact:true}).click();
 const data=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=300;canvas.height=400;const ctx=canvas.getContext("2d")!;ctx.fillStyle="white";ctx.fillRect(0,0,300,400);ctx.fillStyle="black";ctx.font="22px sans-serif";ctx.fillText("apple",30,40);return canvas.toDataURL("image/png").split(",")[1];});
 await page.locator('input[type="file"][accept="image/*"][multiple]').first().setInputFiles(["one","two"].map(name=>({name:name+".png",mimeType:"image/png",buffer:Buffer.from(data,"base64")})));
 await expect(page.getByRole("region",{name:"圖片辨識工作清單"}).locator("article")).toHaveCount(2);
 await page.getByRole("button",{name:"開始辨識／只重試未完成圖片"}).click();await expect(page.locator(".image-jobs")).toContainText("失敗");await expect(page.locator(".import-preview")).toContainText("核對結果（1 字）");expect(calls).toBe(2);expect(prompts[0]).toContain("禁止從例句");
 await page.getByRole("button",{name:"開始辨識／只重試未完成圖片"}).click();await expect(page.locator(".import-preview")).toContainText("核對結果（2 字）");expect(calls).toBe(3);
 await page.getByRole("checkbox",{name:"選取第 2 個單字"}).uncheck();await page.getByRole("textbox",{name:"第 1 個解釋",exact:true}).fill("蘋果（已核對）");await page.getByRole("button",{name:"確認加入所選單字"}).click();await expect.poll(async()=> (await deviceState(page)).cards.length).toBe(2);expect((await deviceState(page)).cards[1].definition).toBe("蘋果（已核對）");
});
test("chat header/composer follow viewport, streamed reply cannot execute action before confirmation",async({page})=>{
 await page.route("https://generativelanguage.googleapis.com/**",async route=>{await route.fulfill({headers:{"content-type":"text/event-stream"},body:`data: ${JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({reply:"你好",action:{type:"createDeck",name:"AI 提議",course:"英文",cards:[]}})}]},finishReason:"STOP"}]})}\n\n`});});
 await page.goto("/");await page.getByRole("button",{name:"Vocab AI",exact:true}).click();await page.getByRole("textbox",{name:"傳送訊息給 Vocab AI"}).fill("你好");
 await page.evaluate(()=>{document.documentElement.style.setProperty("--visible-height","420px");document.documentElement.style.setProperty("--visible-top","60px");document.documentElement.dataset.keyboard="true";});
 const header=await page.locator(".ai-sheet>header").boundingBox(),composer=await page.locator(".ai-sheet .composer").boundingBox();expect(header!.y).toBeCloseTo(60,0);expect(composer!.y+composer!.height).toBeLessThanOrEqual(480);
 await page.getByRole("button",{name:"送出",exact:true}).click();await expect(page.locator(".message.assistant")).toContainText("你好");await expect(page.getByText("等待你的確認")).toBeVisible();expect((await deviceState(page)).decks.length).toBe(1);await page.getByRole("button",{name:"確認執行",exact:true}).click();await expect.poll(async()=> (await deviceState(page)).decks.length).toBe(2);
});
test("editor drafts survive closing and reopening",async({page})=>{
 await page.goto("/");await page.getByRole("button",{name:"新增單字",exact:true}).click();await page.getByRole("textbox",{name:"英文單字",exact:true}).fill("unfinished");await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("vocab-editor-draft-v1")&&localStorage.getItem(key)?.includes("unfinished")))).toBe(true);await page.getByRole("button",{name:"返回",exact:true}).click();await page.getByRole("button",{name:"新增單字",exact:true}).click();await expect(page.getByText("找到上次未完成的編輯草稿。",{exact:false})).toBeVisible();await page.getByRole("button",{name:"恢復草稿"}).click();await expect(page.getByRole("textbox",{name:"英文單字",exact:true})).toHaveValue("unfinished");
});
test("article missing-word checks retain unfinished chapters and resume until full coverage",async({page})=>{
 let calls=0;await page.route("https://generativelanguage.googleapis.com/**",async route=>{calls++;await route.fulfill({json:{candidates:[{content:{parts:[{text:JSON.stringify({reply:calls<=3?"A chapter without the required term.":"We persist in learning."})}]},finishReason:"STOP"}]}});});
 await page.goto("/");await page.getByRole("button",{name:"Vocab AI",exact:true}).click();await page.getByRole("button",{name:"根據這個資料夾寫一篇文章",exact:true}).click();await expect(page.getByRole("button",{name:"繼續補齊",exact:true})).toBeEnabled();await expect(page.locator(".article-draft")).toContainText("尚缺：persist");expect(calls).toBe(3);
 await page.getByRole("button",{name:"繼續補齊",exact:true}).click();await expect(page.locator(".article-draft h3")).toContainText("文章已完成 · 1 / 1 字");await expect(page.locator(".article-text mark")).toHaveText("persist");await expect(page.locator(".article-text mark")).toHaveAttribute("title","持續");await expect(page.locator(".article-text")).toContainText("A chapter without the required term.");expect(calls).toBe(4);
 await page.reload();await page.getByRole("button",{name:"Vocab AI",exact:true}).click();await expect(page.locator(".article-draft h3")).toContainText("文章已完成");
});
