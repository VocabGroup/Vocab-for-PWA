import { test, expect } from "@playwright/test";

// Isolate existing screen tests from first-visit install/fullscreen prompts.
test.beforeEach(async ({context}) => { await context.addInitScript(() => { localStorage.setItem("vocab-web-entry-v1","browser"); Object.defineProperty(document,"fullscreenEnabled",{value:false,configurable:true}); }); });
import { readFile } from "node:fs/promises";

const backup = {
  format: "vocab-backup", version: 8,
  decks: [{ id: 12, name: "第一課", category: "高中英文", colorHex: "#245FE5", createdAt: 100, sortOrder: 100 }],
  cards: [{ id: 39, deckId: 12, word: "persist", definition: "持續", phonetic: "/pəˈsɪst/", partOfSpeech: "v.",
    exampleSentence: "We persist in learning.", sortOrder: 1234, intervalDays: 10, easeFactor: 2.5, repetitionCount: 3,
    nextReviewTimestamp: 100, createdAt: 100, isFavorite: true }],
  studyLogs: [],
  grammarNotes: [{ id: 7, title: "現在完成式", course: "高中英文", folder: "時態" }],
  grammarPatterns: [{ id: 9, grammarNoteId: 7, formula: "have + p.p." }],
  grammarWritingRecords: [{ id: 10, originalText: "I has studied.", revisedText: "I have studied.", issuesJson: "[]" }],
};

test("mobile install, backup round trip, study undo, and cached restart", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("switch", { name: "晚上 8 點提醒" }).click();
  await page.getByRole("button", { name: "開始學習", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await page.getByRole("button", { name: "安裝到 iPhone／iPad 主畫面" }).click();
  const guide = page.getByRole("dialog", { name: "安裝 Vocab" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("加入主畫面");
  await guide.getByRole("button", { name: "我知道了" }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "資料", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "android-v8.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "確認還原", exact: true }).click();
  await expect(page.getByText("備份已還原", { exact: true })).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出 Android 相容備份" }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.grammarNotes).toEqual(backup.grammarNotes);
  expect(exported.grammarPatterns).toEqual(backup.grammarPatterns);
  expect(exported.grammarWritingRecords).toEqual(backup.grammarWritingRecords);
  expect(exported.cards[0].intervalDays).toBe(10);
  expect(exported.cards[0].sortOrder).toBe(1234);

  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "學習", exact: true }).click();
  await page.getByRole("article", { name: "第一課", exact: true }).locator(".collection-main").click();
  await page.getByRole("button", { name: "依照順序", exact: true }).click();
  await expect(page.locator('.android-flashcard[aria-hidden="false"]')).toContainText("persist");
  // Exercise the pointer swipe interaction, without synthetic rating buttons.
  const cardBox = (await page.locator(".swipe-card-wrap").boundingBox())!;
  await page.mouse.move(cardBox.x + 60, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + 240, cardBox.y + cardBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("heading", { name: "全部記熟了", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回上一步", exact: true }).click();
  await expect(page.locator('.android-flashcard[aria-hidden="false"]')).toContainText("persist");
  const restored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("vocab-device-data", 1);
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const raw = await new Promise<string>((resolve, reject) => {
      const tx = db.transaction("snapshots", "readonly"); const req = tx.objectStore("snapshots").get("state");
      tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error);
    });
    db.close(); return JSON.parse(raw);
  });
  expect(restored.cards[0].intervalDays).toBe(10);
  expect(restored.cards[0].repetitionCount).toBe(3);
  expect(restored.reviewLogs).toEqual([]);
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("navigation").getByRole("button", { name: "主畫面", exact: true }).click();

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("iphone-home-dark.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await expect.poll(() => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg?.active && navigator.serviceWorker.controller);
  })).toBe(true);
  const cached = await page.evaluate(async () => {
    const manifest = await (await caches.match("/offline-assets.json"))!.json() as { urls: string[] };
    return Boolean(await caches.match("/")) && (await Promise.all(manifest.urls.map(async (url: string) => Boolean(await caches.match(url))))).every(Boolean);
  });
  expect(cached).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vocab", exact: true })).toBeVisible();
  await expect(page.getByText("第一課", { exact: true })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "資料夾", exact: true }).click();
  await expect(page.getByText("第一課", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("offline restart retains device data", async ({ page, context, browserName }) => {
  // Keep the real outage assertion: do not report WebKit offline as verified.
  test.fail(browserName === "webkit", "Playwright 1.63 WebKit offline navigation bug: https://github.com/microsoft/playwright/issues/42775; remove after upgrading to the fixed browser.");
  await context.addInitScript(() => {
    if (localStorage.getItem("offline-test-seeded")) return;
    localStorage.setItem("offline-test-seeded", "yes");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({
      version: 1, decks: [{ id: "offline-deck", name: "離線資料", course: "通用", color: "#245FE5", order: 0, createdAt: 100 }],
      cards: [{ id: "offline-card", deckId: "offline-deck", word: "offline", definition: "離線" }],
      logs: [], quizRecords: [], settings: { onboardingDone: true, dailyGoal: 20, theme: "light" },
    }));
  });
  await page.goto("/");
  await expect(page.getByText("離線資料", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vocab", exact: true })).toBeVisible();
  await expect(page.getByText("離線資料", { exact: true })).toBeVisible();
  await expect(page.locator(".pwa-status")).toContainText("離線使用中");
  await page.getByRole("navigation").getByRole("button", { name: "資料夾", exact: true }).click();
  await expect(page.getByText("離線資料", { exact: true })).toBeVisible();
});

test("legacy device data migrates and clearing Vocab preserves unrelated storage", async ({ page, context }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem("migration-test-seeded")) return;
    localStorage.setItem("migration-test-seeded", "yes");
    localStorage.setItem("unrelated-browser-data", "keep-me");
    localStorage.setItem("vocab-pwa-state-v1", JSON.stringify({
      version: 1, decks: [{ id: "old-deck", name: "舊資料", course: "通用", color: "#245FE5", order: 0, createdAt: 100 }],
      cards: [{ id: "old-card", deckId: "old-deck", word: "migrate", definition: "移轉" }],
      logs: [], quizRecords: [], settings: { onboardingDone: true, dailyGoal: 20, theme: "light" },
    }));
  });
  await page.goto("/");
  await expect(page.getByText("舊資料", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("vocab-pwa-state-v1"))).toBeNull();
  await page.reload();
  await expect(page.getByText("舊資料", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("button", { name: "資料", exact: true }).click();
  await page.getByRole("button", { name: "清空所有資料並從 0 開始", exact: true }).click();
  await page.getByRole("button", { name: "確定全部清空", exact: true }).click();
  await expect(page.getByRole("button", { name: "開始學習", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-browser-data"))).toBe("keep-me");
  await page.reload();
  await expect(page.getByRole("button", { name: "開始學習", exact: true })).toBeVisible();
});
