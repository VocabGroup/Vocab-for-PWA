import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });

test("Android source dimensions, themes, shared rows and real course actions", async ({ page, context }, testInfo) => {
  await context.addInitScript(() => {
    if (localStorage.getItem("parity-fixture")) return;
    localStorage.setItem("parity-fixture", "yes");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({ version: 1,
      decks: [
        { id:"d1", name:"第一課", course:"高中英文", color:"#245FE5", order:0, createdAt:100 },
        { id:"d2", name:"旅遊英文與長標題資料夾的截斷測試", course:"旅遊英文", color:"#245FE5", order:1, createdAt:100 },
      ],
      cards: [{ id:"c1", deckId:"d1", word:"persist", definition:"持續", order:0, nextReviewAt:100 }],
      logs:[], quizRecords:[], reviewLogs:[], settings:{ onboardingDone:true, dailyGoal:20, theme:"system", fontScale:1 },
    }));
  });
  await page.emulateMedia({ colorScheme:"light" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name:"繼續今天的學習" })).toBeVisible();
  const styles = await page.locator(".dashboard-progress").evaluate(element => {
    const style = getComputedStyle(element); const title = getComputedStyle(element.querySelector("h2")!);
    return { padding:style.padding, radius:style.borderRadius, background:style.backgroundColor, gap:style.gap,
      font:title.fontSize, line:title.lineHeight, weight:title.fontWeight };
  });
  expect(styles).toEqual({ padding:"20px", radius:"24px", background:"rgb(255, 255, 255)", gap:"12px", font:"17px", line:"23px", weight:"600" });
  const nav = await page.locator(".bottom-nav").evaluate(element => ({ height:element.getBoundingClientRect().height, radius:getComputedStyle(element).borderRadius }));
  expect(nav).toEqual({ height:70, radius:"34px" });
  const row = await page.locator(".modern-list-row").first().evaluate(element => ({ padding:getComputedStyle(element).padding, radius:getComputedStyle(element).borderRadius, gap:getComputedStyle(element).gap }));
  expect(row).toEqual({ padding:"16px", radius:"18px", gap:"12px" });
  await page.getByRole("button", { name:"旅遊英文", exact:true }).click();
  await expect(page.getByRole("button", { name:/第一課/ })).toHaveCount(0);
  await page.getByRole("button", { name:"全部", exact:true }).click();
  await page.getByRole("button", { name:/所有單字/ }).click();
  await expect(page.getByRole("heading", { name:"單字卡 · 1" })).toBeVisible();
  await expect(page.getByText("persist", { exact:true })).toBeVisible();
  await page.getByRole("button", { name:"返回", exact:true }).click();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme:scheme });
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    for (const tab of ["主畫面", "資料夾", "學習", "測驗"] as const) {
      await page.getByRole("navigation").getByRole("button", { name:tab, exact:true }).click();
      if (tab !== "主畫面") {
        const collection = page.getByRole("article", { name:"第一課", exact:true });
        const metrics = await collection.evaluate(element => {
          const css = getComputedStyle(element); const title = getComputedStyle(element.querySelector("strong")!);
          return { radius:css.borderRadius, padding:css.padding, gap:css.gap, font:title.fontSize, line:title.lineHeight };
        });
        expect(metrics).toEqual({ radius:"20px", padding:"12px 14px", gap:"10px", font:"17px", line:"23px" });
        await expect(collection).toContainText("1 張單字");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path:testInfo.outputPath(`${scheme}-${tab}.png`), fullPage:true });
    }
  }
  await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click();
  const collection = page.getByRole("article", { name:"第一課", exact:true });
  await collection.getByRole("button", { name:"更多操作 第一課" }).click();
  await expect(collection.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(collection.getByRole("menu")).toHaveCount(0);
  await expect(collection.getByRole("button", { name:"更多操作 第一課" })).toBeFocused();
  await collection.getByRole("button", { name:"拖曳排序 第一課" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".modern-collection-row").first()).toHaveAttribute("aria-label", "旅遊英文與長標題資料夾的截斷測試");
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name:"資料夾", exact:true }).click();
  await expect(page.locator(".modern-collection-row").first()).toHaveAttribute("aria-label", "旅遊英文與長標題資料夾的截斷測試");
});
