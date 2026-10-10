import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });

// These provider-response fixtures test UI behavior, not service-worker networking.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem("touch-fixture")) return;
    localStorage.setItem("touch-fixture", "yes");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({ version:1, decks:[
      { id:"d1", name:"第一課", course:"英文", order:0 }, { id:"d2", name:"第二課", course:"英文", order:1 }, { id:"d3", name:"第三課", course:"英文", order:2 },
    ], cards:[{ id:"c1", deckId:"d1", word:"persist", definition:"持續", partOfSpeech:"v.", phonetic:"/pəˈsɪst/", exampleSentence:"We persist.", exampleTranslation:"我們堅持。", order:0, nextReviewAt:1 }], logs:[], quizRecords:[], settings:{ onboardingDone:true, theme:"light", autoSpeak:false } }));
  });
});

test("same-origin manifest and transparent nav; independent lookup, history and import", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("https://*google.com/**",route=>route.abort());
  await page.route("https://translate.googleapis.com/**",route=>route.abort());
  await page.route("https://api.dictionaryapi.dev/**", route => route.fulfill({ json:[{word:"resilient",phonetic:"/rɪˈzɪliənt/",meanings:[{partOfSpeech:"adjective",definitions:[{definition:"Able to recover quickly.",example:"A resilient person."}]}]}] }));
  await page.goto("/");
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(new URL(manifest!, page.url()).origin).toBe(new URL(page.url()).origin);
  const response = await page.request.get(new URL(manifest!, page.url()).href); expect(response.ok()).toBe(true);
  const nav = await page.locator(".bottom-nav").evaluate(element => ({ height:element.getBoundingClientRect().height, background:getComputedStyle(element).backgroundColor,
    icon:getComputedStyle(element.querySelector("button.active .icon")!).backgroundColor, button:element.querySelector("button")!.getBoundingClientRect().height }));
  expect(nav.height).toBe(70); expect(nav.button).toBe(58); expect(nav.icon).toBe("rgba(0, 0, 0, 0)"); expect(nav.background).toContain("0.55");
  await page.getByRole("button", { name:"搜尋單字", exact:true }).click();
  await expect(page.getByRole("heading", { name:"搜尋紀錄" })).toBeVisible();
  await page.getByRole("textbox", { name:"搜尋英文單字或中文解釋" }).fill("持續"); await page.getByRole("button", { name:"搜尋", exact:true }).click();
  await expect(page.getByRole("heading", { name:"我的單字庫" })).toBeVisible(); await expect(page.locator(".lookup-local")).toContainText("persist");
  await page.getByLabel("查詢來源", {exact:true}).selectOption("FREE");
  await page.getByRole("textbox", { name:"搜尋英文單字或中文解釋" }).fill("resilient"); await page.getByRole("button", { name:"搜尋", exact:true }).click();
  await expect(page.locator(".lookup-result")).toContainText("Able to recover quickly.");
  await page.screenshot({ path:info.outputPath("search.png") });
  await page.getByRole("button", { name:"加入資料夾", exact:true }).click(); await page.getByRole("button", { name:"英文 · 第二課", exact:true }).click();
  await page.getByRole("button", { name:"搜尋單字", exact:true }).click(); await expect(page.getByRole("button", { name:"resilient", exact:true })).toBeVisible();
  await page.getByRole("button", { name:"resilient", exact:true }).click(); await expect(page.locator(".lookup-local")).toContainText("resilient");
  await page.getByRole("button", { name:"返回", exact:true }).click();
  await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click();
  await page.getByRole("article", { name:"第二課", exact:true }).locator(".collection-main").click();
  await expect(page.locator(".manage-card-list")).toContainText("resilient"); expect(errors).toEqual([]);
});

test("lookup input stays at the top through loading, long results, scrolling and viewport resize",async({page})=>{
  let complete!:()=>void;
  const pending=new Promise<void>(resolve=>{complete=resolve;});
  await page.route("https://translate.googleapis.com/**",async route=>{await pending;await route.fulfill({json:{sentences:[{trans:"長解釋。".repeat(300),orig:"anchorword"}]}});});
  await page.goto("/");await page.getByRole("button",{name:"搜尋單字",exact:true}).click();
  await page.getByLabel("查詢來源", {exact:true}).selectOption("GOOGLE");
  const input=page.getByRole("textbox",{name:"搜尋英文單字或中文解釋"});
  await input.fill("anchorword");const before=(await input.boundingBox())!;
  await page.getByRole("button",{name:"搜尋",exact:true}).click();await expect(page.getByRole("status")).toContainText("正在查詢");
  const loading=(await input.boundingBox())!;expect(loading.y).toBeCloseTo(before.y,0);expect(loading.height).toBeCloseTo(before.height,0);
  complete();await expect(page.locator(".lookup-result")).toBeVisible();
  expect((await input.boundingBox())!.y).toBeCloseTo(before.y,0);
  await page.locator(".lookup-body").evaluate(element=>{element.scrollTop=element.scrollHeight;});
  expect((await input.boundingBox())!.y).toBeCloseTo(before.y,0);
  await page.setViewportSize({width:390,height:360});
  expect((await input.boundingBox())!.y).toBeCloseTo(before.y,0);
  const header=(await page.locator(".lookup-screen>header").boundingBox())!;expect(header.y).toBe(0);expect(header.height).toBe(64);
  await page.setViewportSize({width:1280,height:800});expect((await page.locator(".lookup-screen>header").boundingBox())!.y).toBe(0);
});

test("tap performs 3D flip; control tap does not flip; folder follows pointer and persists multi-row reorder", async ({ page }, info) => {
  await page.goto("/"); await page.getByRole("navigation").getByRole("button", { name:"學習", exact:true }).click();
  await page.getByRole("article", { name:"第一課", exact:true }).locator(".collection-main").click(); await page.getByRole("button", { name:"依照順序", exact:true }).click();
  await page.getByRole("button", { name:"加入收藏", exact:true }).click(); await expect(page.locator(".flip-rotor")).not.toHaveClass(/is-flipped/);
  await page.getByRole("button", { name:"翻到單字卡背面", exact:true }).click(); await expect(page.locator(".flip-rotor")).toHaveClass(/is-flipped/);
  await page.waitForTimeout(550); expect(await page.locator(".flip-rotor").evaluate(element => getComputedStyle(element).transform)).not.toBe("none");
  await expect(page.locator('.flip-face.back[aria-hidden="false"]')).toContainText("我們堅持。"); await page.screenshot({ path:info.outputPath("flip-back.png") });
  await page.getByRole("button", { name:"翻回單字卡正面", exact:true }).click(); await expect(page.locator(".flip-rotor")).not.toHaveClass(/is-flipped/);
  await page.getByRole("button", { name:"返回", exact:true }).click(); await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click();
  const handle = await page.getByRole("button", { name:"拖曳排序 第一課", exact:true }).boundingBox(); const row = page.getByRole("article", { name:"第一課", exact:true }); const box = (await row.boundingBox())!;
  await page.mouse.move(handle!.x + 14, handle!.y + 14); await page.mouse.down(); await page.mouse.move(handle!.x + 14, handle!.y + 14 + (box.height + 12) * 2, { steps:10 });
  await expect(row).toHaveClass(/collection-lifted/); expect((await row.boundingBox())!.y).toBeGreaterThan(box.y + box.height); await page.screenshot({ path:info.outputPath("folder-lift.png") });
  await page.mouse.up(); await expect(page.locator(".page-folders .modern-collection-row").last()).toHaveAttribute("aria-label", "第一課");
  await page.reload(); await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click(); await expect(page.locator(".page-folders .modern-collection-row").last()).toHaveAttribute("aria-label", "第一課");
});

test("chat composer stays within resized viewport; native card list and add layout", async ({ page }, info) => {
  await page.goto("/"); await page.getByRole("button", { name:"Vocab AI", exact:true }).click();
  await expect(page.locator(".chat-messages")).toBeVisible(); await page.getByRole("textbox", { name:"傳送訊息給 Vocab AI" }).fill("這是一段還沒有送出的訊息\n第二行");
  for (const viewport of [{width:390,height:664},{width:320,height:540},{width:390,height:350}]) {
    await page.setViewportSize(viewport); await expect.poll(async () => (await page.locator(".composer").boundingBox())!.y + (await page.locator(".composer").boundingBox())!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:info.outputPath(`chat-${viewport.width}-${viewport.height}.png`) });
  }
  await page.setViewportSize({width:390,height:664}); await page.getByRole("button", { name:"返回", exact:true }).click();
  await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click(); await page.getByRole("article", { name:"第一課", exact:true }).locator(".collection-main").click();
  await expect(page.getByLabel("篩選課程")).toBeVisible(); await expect(page.locator(".select-card")).toHaveCount(0); await page.screenshot({ path:info.outputPath("card-list.png") });
  await page.getByRole("button", { name:"多選管理", exact:true }).click(); await expect(page.locator(".select-card")).toHaveCount(1); await page.getByRole("button", { name:"完成多選", exact:true }).click();
  await page.getByRole("button", { name:"新增單字卡", exact:true }).click(); await page.getByRole("button", { name:"手動輸入單字", exact:false }).click();
  await expect(page.locator(".save-location-card select")).toHaveCount(2); await expect(page.getByRole("heading", { name:"新增單字卡", exact:true })).toBeVisible();
  const grid = await page.locator(".compact-fields").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").map(Number.parseFloat)); expect(grid[1] / grid[0]).toBeCloseTo(1.5,1);
  await page.getByRole("textbox", { name:"英文單字", exact:true }).fill("test"); await page.getByRole("textbox", { name:"繁體中文定義", exact:true }).fill("測試");
  await page.screenshot({ path:info.outputPath("add-card.png") }); await page.getByRole("button", { name:"儲存全部並繼續新增", exact:true }).click();
  await page.getByRole("button", { name:"返回", exact:true }).click(); await page.getByRole("article", { name:"第一課", exact:true }).locator(".collection-main").click(); await expect(page.locator(".manage-card-list")).toContainText("test");
});
