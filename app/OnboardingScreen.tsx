"use client";

import { useState } from "react";
import { MdAutoGraph, MdCheck, MdLocalFireDepartment, MdNotificationsActive } from "react-icons/md";

export function AndroidSwitch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" className="android-switch" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span>{checked && <MdCheck size={16} />}</span></button>;
}

export function OnboardingScreen({ onComplete, preview = false }: { onComplete: (goal: number, reminders: boolean) => void; preview?: boolean }) {
  const [goal, setGoal] = useState(20);
  const [reminders, setReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  async function complete() {
    setBusy(true);
    if (preview) { onComplete(goal, false); return; }
    let allowed = false;
    if (reminders && typeof Notification !== "undefined") {
      try { allowed = (await Notification.requestPermission()) === "granted"; } catch { /* Unsupported permission remains disabled. */ }
    }
    onComplete(goal, allowed);
  }
  return <main className="android-onboarding"><section className="onboarding-card">
    <div className="onboarding-flame"><MdLocalFireDepartment size={38} /></div>
    <h1>每天想學幾張？</h1>
    <p>先選一個舒服的目標，之後隨時能調整。</p>
    <div className="android-goal-options">{[10, 20, 30, 50].map(value => <button key={value} className={`android-filter-chip ${goal === value ? "selected" : ""}`} aria-pressed={goal === value} onClick={() => setGoal(value)}>{value}</button>)}</div>
    <strong>每日 {goal} 張</strong>
    <div className="onboarding-reminder"><MdNotificationsActive size={24} /><div><strong>晚上 8 點提醒</strong><small>未達標時提醒</small></div><AndroidSwitch label="晚上 8 點提醒" checked={reminders} onChange={setReminders} /></div>
    <div className="onboarding-xp"><MdAutoGraph size={24} /><span>完成學習可累積 XP 與連續天數</span></div>
    <button className="primary wide" disabled={busy} onClick={complete}>開始學習</button>
  </section></main>;
}
