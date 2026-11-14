import {test,expect} from "@playwright/test";
test.use({serviceWorkers:"block"});
const id="c".repeat(48);
const share={format:"vocab-folder-share",version:1,decks:[{name:"旅行單字",course:"生活英文",cards:[{word:"journey",definition:"旅程",exampleSentence:"Enjoy your journey.",exampleTranslation:"享受你的旅程。",mastered:true}]}]};
test.beforeEach(async({context,page})=>{
  await context.addInitScript(()=>{
    localStorage.setItem("vocab-web-entry-v1","browser");
    if(!localStorage.getItem("receive-fixture")){
      localStorage.setItem("receive-fixture","yes");
      localStorage.setItem("vocab-pwa-state-v1",JSON.stringify({version:1,decks:[],cards:[],logs:[],quizRecords:[],settings:{onboardingDone:true,theme:"lightBlue",fullscreenOnLaunch:false}}));
    }
  });
  await page.route("**/api/shares/"+id,r=>r.fulfill({json:{share,expiresAt:Date.now()+604800000}}));
});
test("preview routes by device, imports only after confirmation and warns on repeat",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/share#"+id);
  await expect(page.getByRole("heading",{name:"生活英文",exact:true})).toBeVisible();
  await expect(page.getByText("journey",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem("vocab-pending-share"))).toBeNull();
  if(info.project.name==="iphone-webkit"){
    await page.getByRole("button",{name:"存到主畫面版 Vocab"}).click();
    await expect(page.getByRole("heading",{name:"存到主畫面版",exact:true})).toBeVisible();
    await expect(page.getByLabel("分享網址")).toHaveValue(new URL(page.url()).origin+"/share#"+id);
  }else{
    await expect(page.getByRole("link",{name:"用安卓版開啟"})).toHaveAttribute("href",new RegExp(`^intent://share/${id}#Intent;scheme=vocab;package=com\\.aistudio`));
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("share-preview.png"),fullPage:true});
  const receive=()=>page.getByRole("button",{name:info.project.name==="iphone-webkit"?"存到目前瀏覽器":"在網頁匯入",exact:true});
  await receive().click();
  const dialog=page.getByRole("dialog",{name:"匯入分享資料夾",exact:true});
  await expect(dialog).toBeVisible();await dialog.getByLabel("目的課程").fill("我的旅遊");
  await dialog.getByRole("button",{name:"下一步：確認匯入"}).click();
  await expect(dialog).toContainText("我的旅遊");
  await dialog.getByRole("button",{name:"確認匯入所選資料夾"}).click();
  await expect(page.getByRole("status").filter({hasText:"已新增 1 個資料夾、1 個單字"})).toBeVisible();
  await page.getByRole("button",{name:"開啟匯入教材"}).click();
  await expect(page.locator(".manage-card-list")).toContainText("journey");
  await page.goto("/share#"+id);await receive().click();
  await expect(dialog.getByText("這份分享已匯入過",{exact:false})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"下一步：確認匯入"})).toBeDisabled();
  expect(errors).toEqual([]);
});
test("expired share has no import action and retry stays on preview",async({page})=>{
  await page.route("**/api/shares/"+id,r=>r.fulfill({status:410,json:{error:"分享已到期"}}));
  await page.goto("/share#"+id);await expect(page.locator(".receive-state[role=alert]")).toContainText("分享已到期");
  await expect(page.getByRole("button",{name:"在網頁匯入"})).toHaveCount(0);
  await page.getByRole("button",{name:"重新讀取"}).click();await expect(page.locator(".receive-state[role=alert]")).toContainText("分享已到期");
});
test("JSON file import previews, confirms and preserves existing material",async({page})=>{
  await page.goto("/");await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"教材",exact:true}).click();
  await page.locator(".library-tools>summary").click();await page.locator('.folder-sharing input[type="file"]').setInputFiles({name:"lesson.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(share))});
  const dialog=page.getByRole("dialog",{name:"匯入分享資料夾",exact:true});await expect(dialog).toContainText("不沿用精熟度");
  await dialog.getByRole("button",{name:"下一步：確認匯入"}).click();await dialog.getByRole("button",{name:"確認匯入所選資料夾"}).click();
  await expect(page.getByRole("status").filter({hasText:"已新增 1 個資料夾、1 個單字"})).toBeVisible();
});
test("share URL dialog keeps keyboard focus inside and Escape cancels",async({page})=>{
  await page.goto("/");await page.getByRole("navigation",{name:"主要導覽"}).getByRole("button",{name:"教材",exact:true}).click();
  await page.locator(".library-tools>summary").click();await page.getByRole("button",{name:"匯入分享網址",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"匯入分享網址",exact:true});await expect(dialog).toBeVisible();
  for(let i=0;i<5;i++){await page.keyboard.press("Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press("Shift+Tab");expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
});
