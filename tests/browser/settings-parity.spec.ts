import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });
import { readFile } from "node:fs/promises";

test("first launch matches Android goal screen, responsive layout and saves choices", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" }); await page.goto("/");
  await expect(page.getByRole("heading", { name: "每天想學幾張？" })).toBeVisible();
  const metrics = await page.locator(".onboarding-card").evaluate(element => {
    const css = getComputedStyle(element); const title = getComputedStyle(element.querySelector("h1")!);
    return { padding: css.padding, radius: css.borderRadius, gap: css.gap, font: title.fontSize, line: title.lineHeight };
  });
  expect(metrics).toEqual({ padding: "24px", radius: "20px", gap: "18px", font: "24px", line: "31px" });
  await expect(page.getByRole("switch", { name: "晚上 8 點提醒" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "30", exact: true }).click();
  await expect(page.getByText("每日 30 張", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("onboarding-light.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.locator(".android-goal-options").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("switch", { name: "晚上 8 點提醒" }).click();
  await page.getByRole("button", { name: "開始學習", exact: true }).click();
  await expect(page.getByRole("heading", { name: "繼續今天的學習" })).toBeVisible();
  await page.reload(); await expect(page.locator(".dashboard-progress")).toContainText("/ 30");
});

test("all eight Android settings routes work, preserve data, and exclude every saved key from backups", async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await context.addInitScript(() => {
    if (localStorage.getItem("settings-fixture")) return; localStorage.setItem("settings-fixture", "yes");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({ version: 1, decks: [{ id: "d1", name: "第一課", course: "英文", order: 0 }], cards: [], logs: [], quizRecords: [], settings: { onboardingDone: true, theme: "light", dailyGoal: 20 } }));
  });
  await page.goto("/"); await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.locator(".android-settings-entry")).toHaveCount(8);
  const metrics = await page.locator(".android-settings-entry").first().evaluate(element => ({ padding: getComputedStyle(element).padding, radius: getComputedStyle(element).borderRadius,
    font: getComputedStyle(element.querySelector("strong")!).fontSize, line: getComputedStyle(element.querySelector("strong")!).lineHeight, subtitle: getComputedStyle(element.querySelector("small")!).fontSize }));
  expect(metrics).toEqual({ padding: "18px", radius: "18px", font: "17px", line: "23px", subtitle: "14px" });
  for (const name of ["外觀", "學習", "AI", "掃描與文件", "單字查詢", "發音與提醒", "更新", "資料"]) {
    await page.locator(".android-settings-entry").filter({ has: page.getByText(name, { exact: true }) }).click();
    await expect(page.locator(".android-settings>header h2")).toHaveText(name);
    expect(await page.locator(".android-settings>header").evaluate(element => element.getBoundingClientRect().height)).toBe(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`settings-${name}.png`) });
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await expect(page.locator(".android-settings-entry")).toHaveCount(8);
  }
  await page.locator(".android-settings-entry").filter({ has: page.getByText("學習", { exact: true }) }).click();
  await page.getByRole("button", { name: "增加每日學習目標" }).click();
  await expect(page.getByText("25 張", { exact: true })).toBeVisible();
  await page.goBack(); await expect(page.locator(".android-settings-entry")).toHaveCount(8);
  await page.locator(".android-settings-entry").filter({ has: page.getByText("AI", { exact: true }) }).click();
  await expect(page.getByLabel("AI 供應商").locator("option")).toHaveCount(4);
  await page.getByLabel("貼上 API Key", { exact: true }).fill("private-fixture-key-never-send");
  await page.getByRole("button", { name: "加入 Key", exact: true }).click();
  await expect(page.getByRole("button", { name: "測試這組 Google Gemini API" })).toBeVisible();
  await expect(page.getByLabel("貼上新的 API Key")).toHaveValue("");
  await page.getByLabel("自訂 Prompt", { exact: true }).fill("保留原句，只補翻譯。只輸出 JSON。");
  await page.getByRole("button", { name: "儲存 Prompt", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.locator(".android-settings-entry").filter({ has: page.getByText("資料", { exact: true }) }).click();
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("button", { name: "建立完整備份" }).click();
  const backup = JSON.parse(await readFile((await (await downloadEvent).path())!, "utf8"));
  expect(JSON.stringify(backup)).not.toContain("private-fixture-key-never-send"); expect(backup.settings.aiProfiles).toEqual([]);
  expect(backup.settings.dailyGoal).toBe(25); expect(backup.settings.aiWordPrompt).toContain("保留原句");
  await page.reload(); await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.locator(".android-settings-entry").filter({ has: page.getByText("學習", { exact: true }) }).click();
  await expect(page.getByText("25 張", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("onboarding preview is nondestructive; scanner matches source button row and empty state", async ({ page, context }, testInfo) => {
  await context.addInitScript(() => {
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({ version: 1, decks: [], cards: [], logs: [], quizRecords: [], settings: { onboardingDone: true, dailyGoal: 35, theme: "dark" } }));
  });
  await page.goto("/?preview=onboarding"); await expect(page.getByRole("heading", { name: "每天想學幾張？" })).toBeVisible();
  await page.getByRole("switch", { name: "晚上 8 點提醒" }).click(); await page.getByRole("button", { name: "開始學習" }).click();
  await expect(page.locator(".dashboard-progress")).toContainText("/ 35");
  await page.getByRole("button", { name: "掃描匯入", exact: true }).click();
  await expect(page.getByRole("heading", { name: "等待辨識內容" })).toBeVisible();
  await expect(page.getByText("尚未建立資料夾；可以先辨識，但無法匯入。")).toBeVisible();
  await expect(page.locator(".scan-source-list button")).toHaveCount(4);
  expect(await page.locator(".scan-source-list button").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(["拍照", "掃描", "相片", "檔案"]);
  expect(await page.locator(".scan-source-list button").first().evaluate(element => ({ height: element.getBoundingClientRect().height, radius: getComputedStyle(element).borderRadius }))).toEqual({ height: 48, radius: "14px" });
  await page.screenshot({ path: testInfo.outputPath("scanner-dark.png"), fullPage: true });
});
