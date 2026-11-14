import {test,expect,type Page} from "@playwright/test";
test.use({serviceWorkers:"block"});
test.beforeEach(async({context})=>{
  await context.addInitScript(()=>{
    localStorage.setItem("vocab-web-entry-v1","browser");
    Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true});
    if(localStorage.getItem("editorial-fixture"))return;
    localStorage.setItem("editorial-fixture","yes");
    localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[{id:"d1",name:"旅行",course:"生活英文",order:0}],cards:["journey","persist","resilient"].map((word,i)=>({id:"c"+i,deckId:"d1",word,definition:["旅程","堅持","有韌性的"][i],partOfSpeech:"n.",exampleSentence:`Enjoy the ${word}.`,exampleTranslation:"享受學習。",notes:"保留的筆記",mastered:i===1,favorite:true,intervalDays:10,repetitionCount:2,nextReviewAt:1,order:i})),logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"lightBlue",autoSpeak:false,fullscreenOnLaunch:false}}));
  });
});
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test("paper layouts keep course, folder, menu, notebook and all quiz modes reachable",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");await expect(page.locator(".word-poster")).toContainText("journey");await fits(page);
  await page.screenshot({path:info.outputPath("today.png")});
  const nav=page.getByRole("navigation",{name:"主要導覽"});await nav.getByRole("button",{name:"教材",exact:true}).click();
  await page.getByRole("button",{name:"開啟課程 生活英文"}).click();await fits(page);
  await page.getByRole("button",{name:"分享課程",exact:true}).click();await expect(page.getByRole("dialog",{name:"分享資料夾",exact:true})).toContainText("旅行");
  await page.getByRole("dialog",{name:"分享資料夾",exact:true}).getByRole("button",{name:"取消",exact:true}).click();
  await page.getByRole("article",{name:"旅行",exact:true}).locator(".collection-main").click();
  await expect(page.getByRole("button",{name:"新增單字卡",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"單字操作 persist",exact:true}).click();await expect(page.getByRole("menuitem")).toHaveCount(4);
  await page.getByRole("menuitem",{name:"編輯",exact:true}).click();await expect(page.locator(".manual-card-group")).toHaveCount(3);
  await expect(page.locator(".editor-jump select")).toHaveValue("c1");
  for(const width of [320,390]){await page.setViewportSize({width,height:760});await fits(page);await expect(page.getByRole("button",{name:"AI 一鍵補齊",exact:true}).locator("span").last()).toBeVisible();}
  await page.screenshot({path:info.outputPath("notebook-editor.png")});
  await page.getByRole("button",{name:"返回",exact:true}).click();await page.getByRole("button",{name:"返回",exact:true}).click();
  await nav.getByRole("button",{name:"練習",exact:true}).click();await page.locator(".practice-tabs").getByRole("button",{name:"測驗",exact:true}).click();
  await page.getByRole("button",{name:/測驗全部/}).click();await expect(page.locator(".mode-grid>button")).toHaveCount(11);await fits(page);
  await page.screenshot({path:info.outputPath("quiz-setup.png")});expect(errors).toEqual([]);
});
test("search, AI composer, scan, import and settings keep stable mobile layouts",async({page},info)=>{
  await page.goto("/");await page.getByRole("button",{name:"搜尋單字",exact:true}).click();
  const input=page.getByRole("textbox",{name:"搜尋英文單字或中文解釋"});const before=await input.boundingBox();
  await input.fill("journey");await page.setViewportSize({width:390,height:420});expect((await input.boundingBox())!.y).toBeCloseTo(before!.y,0);await fits(page);
  await page.getByRole("button",{name:"返回",exact:true}).click();await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Vocab AI",exact:true}).click();await expect(page.getByRole("textbox",{name:"傳送訊息給 Vocab AI"})).toBeVisible();
  await page.evaluate(()=>{document.documentElement.style.setProperty("--visible-height","420px");document.documentElement.style.setProperty("--visible-top","0px");document.documentElement.dataset.keyboard="true";});
  const composer=await page.locator(".composer").boundingBox();expect(composer!.y+composer!.height).toBeLessThanOrEqual(420);await fits(page);
  await page.screenshot({path:info.outputPath("ai-keyboard.png")});await page.getByRole("button",{name:"返回",exact:true}).click();
  await page.evaluate(()=>{document.documentElement.style.removeProperty("--visible-height");document.documentElement.style.removeProperty("--visible-top");delete document.documentElement.dataset.keyboard;});
  await page.getByRole("button",{name:"掃描匯入",exact:true}).click();await expect(page.getByRole("list",{name:"目前步驟"})).toBeVisible();await fits(page);await page.screenshot({path:info.outputPath("scan.png")});await page.getByRole("button",{name:"返回",exact:true}).click();
  await page.getByRole("button",{name:"匯入單字集",exact:false}).click();await fits(page);await page.getByRole("button",{name:"返回",exact:true}).click();
  await page.getByRole("button",{name:"設定",exact:true}).click();await expect(page.locator(".android-settings-entry")).toHaveCount(8);
  await page.getByRole("button",{name:"外觀",exact:true}).click();await page.getByRole("button",{name:"暗色",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await fits(page);
  await page.screenshot({path:info.outputPath("settings-dark.png")});
});
test("desktop workspace does not overflow and native mobile dock stays available",async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto("/");
  await expect(page.getByRole("complementary",{name:"桌面工作區"})).toBeVisible();await fits(page);
  await page.getByRole("navigation",{name:"桌面導覽"}).getByRole("button",{name:"教材",exact:true}).click();await page.getByRole("button",{name:"開啟課程 生活英文"}).click();await fits(page);
  await page.screenshot({path:info.outputPath("desktop-library.png")});
  await page.setViewportSize({width:320,height:720});await expect(page.getByRole("complementary",{name:"桌面工作區"})).toBeHidden();await expect(page.getByRole("navigation",{name:"主要導覽"})).toBeVisible();await fits(page);
});
