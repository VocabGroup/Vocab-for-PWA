# Security and privacy

Report vulnerabilities privately through the repository's GitHub security advisory feature. Do not post keys or user backups in public issues.

## Data boundaries

- Vocabulary, study progress and personal AI credentials are stored in the user's browser, not in a maintainer-operated database. Browser storage is not a hardware-backed credential vault; other code running on the same origin, browser extensions or a compromised device may access it.
- Backups exclude personal AI credentials. AI requests send the selected content and the user's own key to the selected provider. Scanner images stay local until the user explicitly starts AI recognition.
- No maintainer Gemini, OpenAI, GitHub or Cloudflare key is distributed with the application. Do not configure such keys in public frontend environment variables.
- Hosting providers receive normal connection metadata. Dictionary queries and public-deck imports contact third-party services.

## Deployment safeguards

Only build output from `npm run build:pages` belongs in a Pages deployment. Never upload the entire workspace. Logs, local databases, test traces, backups, `.env`, `.dev.vars`, signing material and `node_modules` are excluded from source publication or deployment.

Public-deck imports only allow listed HTTPS domains, validate every redirect, reject URL credentials/custom ports and bound response sizes and timeouts. The unused image proxy is disabled. Runtime and static responses prohibit framing/object embeds and restrict device permissions.

CSP permits inline framework hydration/styles and HTTPS connections to user-selected AI providers; it is not a strict nonce-based CSP. Do not render untrusted HTML. Production server hardening does not replace browser/OS security or an independent penetration test.

## Dependency review — 2026-10-08

After updating the framework, React server components, Vite and Cloudflare tooling and pinning patched Sharp/fflate versions, `npm audit --omit=dev` reports zero known vulnerabilities. This is a package-advisory check, not a guarantee of zero security risk. Some framework code is bundled from development dependencies; this command alone is not a complete audit of the deployed bundle.

The full audit still reports eight high-severity build/lint dependency entries rooted in `braces` CVE-2026-93687. The upstream advisory has no patched release: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm . These warnings remain visible because npm scans package versions, not our local mitigation; this is not an upstream-certified fix.

`scripts/guard-braces.mjs` applies a reproducible local mitigation to pinned `braces@3.0.3`: its reviewed source hashes must match before any changes, parsing stops at 64 nested blocks, and all recursive compile/stringify/expand entry points (including deep imports) iteratively validate AST depth, node count and cycles. Expansion parent-chain loops are bounded too. The original MIT files/license stay in the package. The patch is idempotent and fails closed on unexpected source changes. `postinstall` and pre-dev/build/lint/core-test hooks apply it; installations using `--ignore-scripts` must invoke it before using tools directly. Direct third-party commands that bypass our scripts are not guaranteed to apply it. Regression tests reject deeply nested strings, deep/cyclic/wide ASTs and parent cycles while verifying ordinary glob behavior. Update or remove this mitigation only after reviewing and testing an upstream fix.

This depth mitigation does not make arbitrary glob expansion safe (combinatorial expansion still exists). These tools must process trusted source/glob configuration only. Keep the dev server bound to loopback, do not run unreviewed pull-request code with deployment credentials, and reassess updates before every release. Do not suppress or misrepresent these remaining warnings.

Use two-factor authentication on hosting/GitHub accounts. Grant integrations access only to the intended repository. Never export browser sessions, cookies or account passwords into the project. Revoke and rotate any credential actually disclosed, including in Git history.
