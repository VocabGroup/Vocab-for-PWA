"use client";

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { MdAdd, MdArrowBack, MdDelete, MdDeleteForever, MdEdit, MdOpenInNew, MdRemove, MdRestore, MdVolumeUp } from "react-icons/md";
import type { AppSettings, VocabState } from "./types";
import { downloadAndroidBackup, normalizeBackup } from "./storage";
import { DEFAULT_IMAGE_PROMPT, DEFAULT_WORD_PROMPT } from "./prompts";
import { AndroidSwitch } from "./OnboardingScreen";
import { AI_PROVIDERS, fetchAiModels, requestAiCredential } from "./ai-client";
import { speakText } from "./speech";
import { WebDisplaySettings } from "./WebDisplaySettings";

export const SETTINGS_PAGES = [
  ["外觀", "跟隨系統、亮色與暗色"], ["學習", "每日目標與複習"], ["AI", "連線、模型與補齊"],
  ["掃描與文件", "教材辨識與匯入"], ["單字查詢", "辭典與翻譯來源"], ["發音與提醒", "朗讀、自動播放與通知"],
  ["更新", "版本與下載"], ["資料", "備份、匯出與還原"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="android-settings-section"><h3>{title}</h3>{children}</section>; }
function Toggle({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <div className="android-setting-row"><span>{label}</span><AndroidSwitch label={label} checked={value} onChange={onChange} disabled={disabled} /></div>; }
function NumberSetting({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <div className="android-setting-row"><span>{label}</span><div className="android-number-setting"><button className="icon-button" aria-label={`減少${label}`} onClick={() => onChange(Math.max(min, value - step))}><MdRemove size={24} /></button><strong aria-live="polite">{value}{suffix}</strong><button className="icon-button" aria-label={`增加${label}`} onClick={() => onChange(Math.min(max, value + step))}><MdAdd size={24} /></button></div></div>;
}
function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) { return <label className="android-outlined-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>; }

export function SettingsScreen({ state, updateSettings, onClose, onBackup, onRestore, onClear }: { state: VocabState; updateSettings: (patch: Partial<AppSettings>) => void; onClose: () => void; onBackup: () => void; onRestore: (state: VocabState) => void; onClear: () => void }) {
  const [page, setPage] = useState("設定"); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(state.settings.aiWordPrompt); const [imagePrompt, setImagePrompt] = useState(state.settings.aiImagePrompt);
  const [keyInput, setKeyInput] = useState(""); const [models, setModels] = useState<string[]>([]); const [customModel, setCustomModel] = useState(false);
  const [tutorial, setTutorial] = useState(false); const [clearDialog, setClearDialog] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<VocabState | null>(null); const [restoreName, setRestoreName] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [editingTime, setEditingTime] = useState<number | null>(null); const [timeInput, setTimeInput] = useState("20:00");
  const fileRef = useRef<HTMLInputElement>(null); const settings = state.settings; const provider = AI_PROVIDERS[settings.aiProvider];
  const profiles = settings.aiProfiles?.length ? settings.aiProfiles : settings.aiApiKey ? [{ id: "legacy", provider: settings.aiProvider, key: settings.aiApiKey, model: settings.aiModel }] : [];
  const times = settings.reminderTimes ?? [settings.reminderTime];
  const dialogRef = useRef<HTMLElement>(null);
  const dialogOpen = clearDialog || !!pendingRestore || tutorial || editingTime !== null;
  const closeDialog = () => { setClearDialog(false); setPendingRestore(null); setTutorial(false); setEditingTime(null); };
  const back = () => { if (page === "設定") onClose(); else { history.back(); setStatus(""); } };
  useEffect(() => {
    const speech = window.speechSynthesis; if (!speech) return;
    const load = () => setVoices(speech.getVoices().filter(voice => voice.lang.toLowerCase().startsWith("en")));
    load(); speech.addEventListener("voiceschanged", load); return () => speech.removeEventListener("voiceschanged", load);
  }, []);
  useEffect(() => {
    if (page === "設定") return;
    const pop = () => setPage(history.state?.vocabSettingsPage ?? "設定");
    window.addEventListener("popstate", pop); return () => window.removeEventListener("popstate", pop);
  }, [page]);
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]') ?? []);
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setClearDialog(false); setPendingRestore(null); setTutorial(false); setEditingTime(null); }
      if (event.key === "Tab") { const targets = focusable(); const index = targets.indexOf(document.activeElement as HTMLElement); if (event.shiftKey && index <= 0) { event.preventDefault(); targets.at(-1)?.focus(); } else if (!event.shiftKey && index === targets.length - 1) { event.preventDefault(); targets[0]?.focus(); } }
    };
    window.addEventListener("keydown", key); return () => { window.removeEventListener("keydown", key); previous?.focus(); };
  }, [dialogOpen]);
  async function run(task: () => Promise<string>) { if (busy) return; setBusy(true); setStatus("正在連線…"); try { setStatus(await task()); } catch (error) { setStatus(error instanceof Error ? error.message : "連線失敗"); } finally { setBusy(false); } }
  const toggle = (label: string, key: keyof AppSettings, fallback = false) => <Toggle key={key} label={label} value={Boolean(settings[key] ?? fallback)} onChange={value => updateSettings({ [key]: value })} />;
  const number = (label: string, key: keyof AppSettings, min: number, max: number, step: number, suffix = "", fallback = min) => <NumberSetting label={label} value={Number(settings[key] ?? fallback)} min={min} max={max} step={step} suffix={suffix} onChange={value => updateSettings({ [key]: value })} />;
  async function readBackup(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { setPendingRestore(normalizeBackup(JSON.parse(await file.text()))); setRestoreName(file.name); } catch (error) { setStatus(`無法還原：${(error as Error).message}`); } }
  function saveTimes(next: string[]) { const unique = [...new Set(next)].sort(); updateSettings({ reminderTimes: unique, reminderTime: unique[0] ?? "20:00" }); }
  function exportCsv() {
    const quote = (value: string) => `"${(/^[=+\-@]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const lines = [["單字", "音標", "詞性", "中文解釋", "英文例句", "中文例句", "註記", "資料夾"], ...state.cards.map(card => [card.word, card.phonetic, card.partOfSpeech, card.definition, card.exampleSentence, card.exampleTranslation, card.notes, state.decks.find(deck => deck.id === card.deckId)?.name ?? ""])];
    const href = URL.createObjectURL(new Blob(["\ufeff" + lines.map(row => row.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = href; anchor.download = "vocab-cards.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }
  return <div className="page-backdrop sheet-backdrop"><section className="sheet sheet-wide android-settings" role="main">
    <header><button className="icon-button" aria-label="返回" onClick={back}><MdArrowBack size={24} /></button><h2>{page}</h2></header>
    <div className="android-settings-body" key={page}>
      {page === "設定" && SETTINGS_PAGES.map(([title, subtitle]) => <button className="android-settings-entry" aria-label={title} aria-describedby={`settings-sub-${title}`} key={title} onClick={() => { history.pushState({ ...history.state, vocabPage: "settings", vocabSettingsPage: title }, ""); setPage(title); setStatus(""); }}><span><strong>{title}</strong><small id={`settings-sub-${title}`}>{subtitle}</small></span><span aria-hidden="true">›</span></button>)}
      {page === "外觀" && <Section title="主題"><div className="android-theme-options">{([["light", "亮色"], ["dark", "暗色"], ["system", "系統"]] as const).map(([value, label]) => <button className={`android-filter-chip ${settings.theme === value ? "selected" : ""}`} aria-pressed={settings.theme === value} key={value} onClick={() => updateSettings({ theme: value, gradientEnabled: false, customTextEnabled: false, backgroundBrightness: 1, backgroundOpacity: 1 })}>{label}</button>)}</div><p>畫面與文字顏色隨主題統一調整。</p></Section>}
      {page === "學習" && <Section title="學習">{number("每日學習目標", "dailyGoal", 5, 100, 5, " 張")}{number("每日新卡上限", "dailyNewCardLimit", 1, 100, 5)}{number("每日複習上限", "dailyReviewLimit", 10, 500, 10)}{toggle("測驗錯題加入複習", "gameMistakesToReview")}</Section>}
      {page === "外觀" && <WebDisplaySettings settings={settings} updateSettings={updateSettings}/>}
      {page === "AI" && <><Section title="AI 補齊">{toggle("啟用 AI 補齊", "aiEnabled")}{toggle("AI 結果套用前確認", "aiRequiresConfirmation")}{toggle("使用我自己的 API Key", "usePersonalAiApi")}<p>{settings.usePersonalAiApi ? `${provider.name} 直連` : "Vocab Gateway（未部署時無法使用）"}</p><label className="android-outlined-field"><span>自訂 Prompt</span><textarea aria-label="自訂 Prompt" rows={4} maxLength={4000} value={prompt} onChange={event => setPrompt(event.target.value)} /></label><div className="android-prompt-actions"><button className="primary" disabled={!prompt.trim()} onClick={() => { updateSettings({ aiWordPrompt: prompt }); setStatus("Prompt 已儲存"); }}>儲存 Prompt</button><button className="android-text-button" onClick={() => { setPrompt(DEFAULT_WORD_PROMPT); updateSettings({ aiWordPrompt: DEFAULT_WORD_PROMPT }); }}><MdRestore size={18} />重設</button></div></Section>
        <Section title="AI 連線"><SelectSetting label="AI 供應商" value={settings.aiProvider} options={Object.entries(AI_PROVIDERS).map(([id, value]) => [id, value.name])} onChange={value => { const id = value as AppSettings["aiProvider"]; const next = AI_PROVIDERS[id]; updateSettings({ aiProvider: id, aiBaseUrl: next.base, aiModel: next.models[0], aiApiKey: profiles.find(profile => profile.provider === id)?.key ?? "" }); setKeyInput(""); setModels([]); setCustomModel(false); }} />
          <button className="secondary wide" onClick={() => setTutorial(true)}>查看 AI 連線教學</button><a className="primary android-button-link" href={provider.keyUrl} target="_blank" rel="noreferrer"><MdOpenInNew size={24} />取得 API Key</a>
          <label className="android-outlined-field"><span>{profiles.some(profile => profile.provider === settings.aiProvider) ? "貼上新的 API Key" : "貼上 API Key"}</span><input type="password" autoComplete="off" value={keyInput} onChange={event => setKeyInput(event.target.value)} /></label>
          <button className="primary wide" disabled={!keyInput.trim()} onClick={() => { updateSettings({ aiApiKey: keyInput.trim(), aiProfiles: [...profiles, { id: crypto.randomUUID(), provider: settings.aiProvider, model: settings.aiModel, key: keyInput.trim() }] }); setKeyInput(""); setStatus("API Key 已儲存在這台裝置"); }}>{profiles.some(profile => profile.provider === settings.aiProvider) ? "加入另一把 Key" : "加入 Key"}</button>
          <SelectSetting label="AI 模型" value={customModel || ![...provider.models, ...models].includes(settings.aiModel) ? "__custom__" : settings.aiModel} options={[...new Set([...provider.models, ...models])].map(id => [id, id] as [string, string]).concat([["__custom__", "自訂模型 ID…"]])} onChange={value => { setCustomModel(value === "__custom__"); if (value !== "__custom__") updateSettings({ aiModel: value }); }} />
          {(customModel || ![...provider.models, ...models].includes(settings.aiModel)) && <label className="android-outlined-field"><span>自訂模型 ID</span><input value={settings.aiModel} onChange={event => updateSettings({ aiModel: event.target.value })} /></label>}
          <SelectSetting label="聊天風格" value={settings.aiChatStyle ?? "normal"} options={[["normal", "一般"], ["relaxed", "輕鬆"], ["strict", "嚴謹"]]} onChange={value => updateSettings({ aiChatStyle: value as AppSettings["aiChatStyle"] })} />
          <p>{settings.aiChatStyle === "relaxed" ? "語氣自然輕鬆，也能聊英文學習以外的日常話題。" : settings.aiChatStyle === "strict" ? "只處理英文學習、單字庫與相關知識；不相關話題會禮貌拒絕，回答也會更審慎。" : "一般助理語氣，兼顧清楚、自然與實用性。"}</p>
          <button className="secondary wide" disabled={busy} onClick={() => run(async () => { const available = await fetchAiModels(settings); setModels(available); return `已更新 ${available.length} 個模型`; })}>更新模型清單</button>
          {!!profiles.length && <strong>已儲存的 API Key</strong>}{profiles.map((profile, index) => <div className="android-key-card" key={profile.id}><div className="android-setting-row"><div><strong>{index + 1}. {AI_PROVIDERS[profile.provider].name}</strong><p>{profile.model}</p></div><button className="icon-button" aria-label="移除此 API Key" onClick={() => { const next = profiles.filter(item => item.id !== profile.id); updateSettings({ aiProfiles: next, aiApiKey: next.find(item => item.provider === settings.aiProvider)?.key ?? "" }); }}><MdDeleteForever size={24} /></button></div><label className="android-outlined-field"><span>API Key（僅本機保存）</span><input type="password" value="••••••••" readOnly /></label><button className="primary wide" disabled={busy} onClick={() => run(async () => { await requestAiCredential(profile.provider, profile.key, profile.model, AI_PROVIDERS[profile.provider].base, '只輸出 JSON：{"ok":true}'); return `${AI_PROVIDERS[profile.provider].name} 連線成功`; })}>測試這組 {AI_PROVIDERS[profile.provider].name} API</button></div>)}
          <p>Key 只保存在此瀏覽器，不會放進備份。瀏覽器儲存並非 Android 加密金鑰庫；共用裝置不建議儲存私人 Key。模型及跨網域連線須以實際測試結果為準。</p>
        </Section></>}
      {page === "掃描與文件" && <Section title="掃描與文件"><p>拍照、相片與掃描頁面會直接送到目前選擇的多模態 AI 模型。</p><label className="android-outlined-field"><span>圖片辨識 Prompt</span><textarea aria-label="圖片辨識 Prompt" rows={5} maxLength={4000} value={imagePrompt} onChange={event => setImagePrompt(event.target.value)} /></label><div className="android-prompt-actions"><button className="primary" disabled={!imagePrompt.trim()} onClick={() => { updateSettings({ aiImagePrompt: imagePrompt }); setStatus("Prompt 已儲存"); }}>儲存 Prompt</button><button className="android-text-button" onClick={() => { setImagePrompt(DEFAULT_IMAGE_PROMPT); updateSettings({ aiImagePrompt: DEFAULT_IMAGE_PROMPT }); }}><MdRestore size={18} />重設</button></div>{toggle("匯入前預覽", "ocrPreviewBeforeImport")}{number("PDF 頁數上限", "pdfPageLimit", 1, 50, 1)}</Section>}
      {page === "單字查詢" && <Section title="單字查詢"><SelectSetting label="字典來源" value={settings.dictionarySource ?? "AUTO"} options={[["AUTO", "自動選擇（優先 ECDICT）"], ["ECDICT", "ECDICT 英漢字典"], ["GOOGLE", "Google 翻譯"], ["CAMBRIDGE", "劍橋英漢辭典"], ["WIKTIONARY", "維基詞典"], ["FREE", "Free Dictionary（英文解釋）"]]} onChange={value => updateSettings({ dictionarySource: value as AppSettings["dictionarySource"] })} /><p>自動模式優先查詢 ECDICT，查無結果才切換線上來源；中文反查使用 Google。ECDICT 保留原始中文釋義（部分為簡體），不提供例句。網頁首次查詢需要連線下載對應詞庫，已查詢詞庫可離線使用。</p><a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noopener noreferrer">ECDICT 原始專案（MIT）</a></Section>}
      {page === "發音與提醒" && <Section title="發音與提醒">{toggle("翻卡後自動朗讀", "autoSpeak")}<Toggle label="離開 App 後繼續自動朗讀" value={false} onChange={() => {}} disabled /><Toggle label="背景朗讀時顯示浮動視窗" value={false} onChange={() => {}} disabled /><p>網頁版無法顯示跨 App 浮動視窗，也無法保證背景持續朗讀。這兩項是平台限制，沒有假裝啟用。</p>
        <SelectSetting label="聲音風格" value={settings.ttsVoiceStyle} options={[["natural", "自然原聲"], ["female", "女聲風格（較明亮）"], ["male", "男聲風格（較低沉）"]]} onChange={value => updateSettings({ ttsVoiceStyle: value as AppSettings["ttsVoiceStyle"] })} /><SelectSetting label="英文語音" value={settings.ttsVoiceName} options={[["", "自動選擇最佳英文語音"], ...voices.map(voice => [voice.name, `${voice.name}（${voice.lang}）`] as const)]} onChange={value => updateSettings({ ttsVoiceName: value })} /><p>實際可用聲音由手機的語音引擎決定。</p>
        <strong>學習卡正面自動朗讀</strong><p>自動播放會等正面內容全部念完才翻到背面。</p>{toggle("英文單字", "ttsFrontReadWord", true)}{toggle("拼音（逐字母拼讀）", "ttsFrontSpellWord")}{toggle("詞性", "ttsFrontReadPartOfSpeech")}{number("正面朗讀次數", "ttsFrontRepetitions", 1, 3, 1)}
        <strong>學習卡背面自動朗讀</strong><p>需先開啟「翻卡後自動朗讀」；下列內容會依順序組成一組播放。</p>{toggle("英文單字", "ttsReadWord", true)}{toggle("拼音（逐字母拼讀）", "ttsSpellWord")}{toggle("中文解釋", "ttsReadDefinition", true)}{toggle("音標", "ttsReadPhonetic")}{toggle("詞性", "ttsReadPartOfSpeech")}{toggle("英文例句", "ttsReadExample", true)}{toggle("中文例句", "ttsReadExampleTranslation", true)}{number("每組朗讀次數", "ttsGroupRepetitions", 1, 3, 1)}
        <label className="android-speed">朗讀速度 {settings.speechRate.toFixed(1)} 倍<input type="range" min="0.5" max="1.5" step="0.1" value={settings.speechRate} onChange={event => updateSettings({ speechRate: Number(event.target.value) })} /></label><button className="primary wide" onClick={() => speakText("Welcome to Vocab", settings.speechRate)}><MdVolumeUp size={24} />試聽目前聲音</button>
        <Toggle label="每日學習提醒" value={settings.remindersEnabled} onChange={async value => { if (!value) updateSettings({ remindersEnabled: false }); else if (typeof Notification !== "undefined") { try { updateSettings({ remindersEnabled: (await Notification.requestPermission()) === "granted" }); } catch { setStatus("這個瀏覽器不支援通知權限"); } } else setStatus("這個瀏覽器尚無法啟用通知；iPhone 請先加入主畫面"); }} />
        {times.map((time, index) => <div className="android-reminder-time" key={`${index}-${time}`}><strong>{time}</strong><button className="icon-button" aria-label={`編輯 ${time}`} onClick={() => { setEditingTime(index); setTimeInput(time); }}><MdEdit size={24} /></button><button className="icon-button" aria-label={`刪除 ${time}`} disabled={times.length <= 1} onClick={() => saveTimes(times.filter((_, item) => item !== index))}><MdDelete size={24} /></button></div>)}<button className="secondary wide" disabled={times.length >= 8} onClick={() => { setEditingTime(-1); setTimeInput("20:00"); }}>新增提醒時間</button><p>網頁版只在 App 開啟時檢查提醒，不能保證背景定時通知。</p>
      </Section>}
      {page === "更新" && <Section title="更新">{toggle("自動檢查更新", "autoCheckUpdates")}<Toggle label="僅使用 Wi-Fi 更新" value={settings.wifiOnlyUpdates} disabled onChange={() => {}} /><p>目前版本 3.1.2 · 網頁移植測試版</p><p>瀏覽器無法可靠判斷 Wi-Fi。本機開發版沒有公開更新；正式 PWA 由瀏覽器更新，不下載 Android APK。</p><button className="primary wide" onClick={() => run(async () => { const registration = await navigator.serviceWorker?.getRegistration(); if (!registration) return "本機開發版沒有公開更新"; await registration.update(); window.dispatchEvent(new Event("vocab-show-update")); return registration.waiting ? "新版已下載，請使用畫面上的更新提示重新開啟" : "已檢查網頁更新"; })} disabled={busy}>檢查更新</button><button className="secondary wide" onClick={() => window.dispatchEvent(new Event("vocab-install-help"))}>安裝到 iPhone／iPad 主畫面</button></Section>}
      {page === "資料" && <Section title="資料"><p className="android-body-text">單字與學習資料預設只儲存在本機。</p><button className="primary wide" onClick={onBackup}>建立完整備份</button><button className="primary wide" onClick={() => fileRef.current?.click()}>還原備份</button><button className="primary wide" onClick={exportCsv}>匯出 CSV</button><button className="danger-button wide" onClick={() => setClearDialog(true)}><MdDeleteForever size={24} />清空所有資料並從 0 開始</button><button className="android-text-button" onClick={() => downloadAndroidBackup(state)}>匯出 Android 相容備份</button><p>Android 匯入的文法、作文等資料會保留在備份中；這些編輯頁仍在移植。</p><input hidden ref={fileRef} type="file" accept="application/json,.json" onChange={readBackup} /></Section>}
      {status && <p className="android-settings-status" role="status">{status}</p>}
    </div>
    {dialogOpen && <div className="nested-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}><section ref={dialogRef} className="nested-dialog android-alert" role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title">
      <h3 id="settings-dialog-title">{clearDialog ? "清空所有資料？" : pendingRestore ? "還原完整備份？" : tutorial ? "AI 連線教學" : "提醒時間"}</h3>
      {clearDialog ? <p>會刪除所有單字卡、資料夾、學習紀錄、設定及本機 API Key，並回到首次設定。此動作無法復原。</p> : pendingRestore ? <><p>將以「{restoreName}」完整覆蓋這台裝置目前的資料，無法合併。</p><p>{pendingRestore.decks.length} 個資料夾 · {pendingRestore.cards.length} 張單字卡 · {pendingRestore.quizRecords.length} 筆測驗紀錄</p></> : tutorial ? <><strong>{provider.name}</strong><p>登入供應商 → 建立 API Key → 選供應商、貼上 Key → 加入 Key → 選模型 → 按「測試這組」。不要將 Key 傳到聊天室、截圖或 GitHub。</p><a href={provider.keyUrl} target="_blank" rel="noreferrer">前往取得 API Key</a></> : <input aria-label="提醒時間" type="time" value={timeInput} onChange={event => setTimeInput(event.target.value)} />}
      <div className="android-dialog-actions"><button className="android-text-button" onClick={() => { setClearDialog(false); setPendingRestore(null); setTutorial(false); setEditingTime(null); }}>{tutorial ? "完成" : "取消"}</button>{!tutorial && <button className="android-text-button" onClick={() => { if (clearDialog) { setClearDialog(false); onClear(); } else if (pendingRestore) { setPrompt(pendingRestore.settings.aiWordPrompt); setImagePrompt(pendingRestore.settings.aiImagePrompt); onRestore(pendingRestore); setPendingRestore(null); setStatus("還原完成"); } else if (editingTime !== null && timeInput) { saveTimes(editingTime < 0 ? [...times, timeInput] : times.map((time, index) => index === editingTime ? timeInput : time)); setEditingTime(null); } }}>{clearDialog ? "確定全部清空" : pendingRestore ? "確認還原" : "確定"}</button>}</div>
    </section></div>}
  </section></div>;
}
