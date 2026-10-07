import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });

test.use({serviceWorkers:"block"});
test.beforeEach(async ({context}) => {
  await context.addInitScript(() => {
    if (localStorage.getItem("editor-fixture")) return;
    localStorage.setItem("editor-fixture","yes");
    localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"第一課",course:"英文",order:0}],cards:Array.from({length:16},(_,i)=>({id:`c${i+1}`,deckId:"d1",word:`word${i+1}`,definition:`定義${i+1}`,order:i,favorite:true,nextReviewAt:123456,repetitionCount:4,notes:"保留筆記"})),logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"light",autoSpeak:false}}));
  });
});

test("menu and card click open shared multi-card editor at selected word; save preserves progress",async ({page},info)=>{
  await page.goto("/");
  await page.getByRole("navigation").getByRole("button",{name:"資料夾",exact:true}).click();
  await page.getByRole("article",{name:"第一課",exact:true}).locator(".collection-main").click();
  await page.getByRole("button",{name:"單字操作 word13",exact:true}).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveCount(4);
  const menu=(await page.getByRole("menu").boundingBox())!;
  expect(menu.width).toBe(220); expect(menu.x).toBeGreaterThanOrEqual(0);
  await page.screenshot({path:info.outputPath("card-menu.png")});
  await page.getByRole("menuitem",{name:"編輯",exact:true}).click();
  await expect(page.locator(".manual-card-group")).toHaveCount(16);
  for(const width of [320,390]) {
    await page.setViewportSize({width,height:664});
    const action=page.getByRole("button",{name:"AI 一鍵補齊",exact:true});
    await expect(action.locator("span").last()).toBeVisible();
    const bounds=(await action.boundingBox())!;expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const target=page.locator('[data-card-id="c13"]');
  await expect(target).toHaveClass(/editor-target/);
  await expect.poll(async()=> (await target.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await expect.poll(async()=> (await target.boundingBox())!.y).toBeLessThan(300);
  await page.screenshot({path:info.outputPath("editor-selected.png")});
  await target.getByRole("textbox",{name:"繁體中文定義",exact:true}).fill("修改十三");
  await page.locator('[data-card-id="c14"]').getByRole("textbox",{name:"繁體中文定義",exact:true}).fill("修改十四");
  await page.getByRole("button",{name:"儲存全部變更",exact:true}).click();
  await page.getByRole("button",{name:"儲存全部變更",exact:true}).click();
  const cards=await page.evaluate(async()=> {
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("vocab-device-data",1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const raw=await new Promise<string>((resolve,reject)=>{const tx=db.transaction("snapshots","readonly"),request=tx.objectStore("snapshots").get("state");tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);});
    db.close();return JSON.parse(raw).cards;
  });
  expect(cards).toHaveLength(16); expect(cards.find((c:{id:string})=>c.id==="c13")).toMatchObject({definition:"修改十三",favorite:true,nextReviewAt:123456,repetitionCount:4,notes:"保留筆記"});
  expect(cards.find((c:{id:string})=>c.id==="c14").definition).toBe("修改十四");
  await page.getByRole("button",{name:"返回",exact:true}).click();
  await page.getByRole("button",{name:"word5",exact:false}).filter({has:page.locator("strong")}).click();
  await expect(page.locator(".manual-card-group")).toHaveCount(16);
  await expect(page.locator('[data-card-id="c5"]')).toHaveClass(/editor-target/);
});

test("Google Chinese lookup uses selected source; blocked Cambridge is not mislabeled",async({page})=>{
  const requests:string[]=[];
  await page.route("**/api/dictionary?**",route=>{
    requests.push(route.request().url());
    const url=new URL(route.request().url());
    return url.searchParams.get("source")==="CAMBRIDGE" ? route.fulfill({status:502,json:{error:"劍橋限制存取（403）"}}) : route.fulfill({json:{entry:{word:"persist",definition:"堅持",source:"Google 中英翻譯",sourceUrl:"https://translate.google.com/",phonetic:"",partOfSpeech:"",exampleSentence:"",exampleTranslation:"",notes:""}}});
  });
  await page.goto("/"); await page.getByRole("button",{name:"搜尋單字",exact:true}).click();
  await page.getByLabel("查詢來源").selectOption("GOOGLE");
  await page.getByRole("textbox",{name:"搜尋英文單字或中文解釋"}).fill("堅持");
  await page.getByRole("button",{name:"搜尋",exact:true}).click();
  await expect(page.locator(".lookup-result")).toContainText("Google 中英翻譯");
  expect(new URL(requests.at(-1)!).searchParams.get("q")).toBe("堅持");
  await page.getByLabel("查詢來源").selectOption("CAMBRIDGE");
  await page.getByRole("textbox",{name:"搜尋英文單字或中文解釋"}).fill("persist");
  await page.getByRole("button",{name:"搜尋",exact:true}).click();
  await expect(page.getByText("劍橋限制存取（403）",{exact:true})).toBeVisible();
  await expect(page.locator(".lookup-result")).toHaveCount(0);
});
