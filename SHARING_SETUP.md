# 分享服務設定與限制

使用既有 Pages 網站 `vocab-adam`，不建立新網站，不需要將 API Token 放進專案。

- Production KV binding：`VOCAB_SHARES`，ID 由 `wrangler.jsonc` 管理；ID 不是密鑰。
- Production encrypted Secret：`SHARE_RATE_SALT`，至少 32 字元，只設定在 Cloudflare。
- Preview 刻意不綁正式教材 KV；本機開發使用本機 KV。不要將正式 Secret 設給不受信任的 PR。
- 缺少綁定或 Secret 時，接口回傳 503，仍可使用檔案分享。

教材寫入 KV 時設 `expirationTtl:604800`。GET 另檢查絕對到期時間，從不更新 TTL；不提供列舉接口。網址用隨機 192-bit ID，撤銷使用另一組隨機憑證的雜湊；關閉分享面板後不保存撤銷憑證，因此無法再透過該面板撤銷，仍會自動到期。

持有連結即可讀取，不是私人帳號授權，也不是端對端加密。避免分享私人筆記；筆記預設排除。連結代碼放在 fragment，但讀取 API 的路徑仍會帶 ID；不要對 API 記錄完整請求路徑／回覆內容。KV 可能短暫延遲同步，撤銷可能不是跨區立即生效；到期時間由應用程式額外強制檢查。

單次 512 KB、50 個資料夾、5,000 字。KV 計數限制每 IP 每 UTC 日 5 次、全站 200 次；IP 使用 Secret 加鹽雜湊，計數 2 天到期。**KV 最終一致性不是原子速率限制，併發時可能超出計數；這不是無限流量、完整防機器人或免費額度的硬保證。** 免費額度耗盡時分享可能暫停，不能因此自動升級付費。需要更強的公開站防濫用時，另評估 Turnstile 或原子計數服務。

發布前：執行 core／browser 測試、lint、typecheck、build:pages、npm audit；確認產物無 `.env`、log、資料庫、來源映射或私人匯出；只發布 `dist/pages`。分享檔不放進公開 GitHub。測試只用合成教材，驗證完撤銷連結。
