# 3.5.1 layout audit

Checked existing PWA workflows using synthetic local material in mobile WebKit and Chromium: today, course/folder lists and menus, card editing/notes, batch/delete/move/add dialogs, study/quiz setup and resume, lookup, AI, scan/corners/camera/retry, import, share preview/confirmation/JSON, onboarding/install, all eight settings subpages and desktop workspace.

New page-audit cases check 320 px width, short keyboard-like visible viewports with nonzero top offset, landscape dialogs, dark settings, Escape cancellation and retained card count. Core tests check menu placement for offscreen anchors. Keyboard geometry is simulated; physical iPhone keyboard and hardware camera behavior are not certified by desktop tests.

Corrections: document-flow create/import actions no longer cover the last folder; portal menus clamp to the visible viewport; overlays use keyboard viewport height; modal focus and Escape behavior are shared; safe-area headers, long text, dialog scrolling and wrapping actions are consistent.

No data model changes or feature removal. Android-only grammar/writing backup data continues through AndroidArchive; this is not a new web grammar editor. Share browser tests mock storage/provider requests so regression checks do not upload personal material.

Release checks: core tests, TypeScript, ESLint, Pages production build, WebKit/Chromium regressions, explicit staged-file review and credential-pattern scan. Environment files, captures, caches, credentials and source maps are excluded from deployment.
