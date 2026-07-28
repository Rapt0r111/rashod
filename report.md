PS C:\Users\Aquarius\Documents\rashod-next> bun run test:e2e:full
$ bun run scripts/run-e2e.ts --full
{
  severity_local: "ЗАМЕЧАНИЕ",
  severity: "NOTICE",
  code: "00000",
  message: "удаление распространяется на ещё 22 объекта",
  detail: "удаление распространяется на объект таблица schema_migrations\nудаление распространяется на объект таблица platoons\nудаление распространяется на объект таблица locations\nудаление распространяется на объект таблица people\nудаление распространяется на объект таблица movement_logs\nудаление распространяется на объект таблица group_templates\nудаление распространяется на объект таблица duty_groups\nудаление распространяется на объект таблица group_rules\nудаление распространяется на объект таблица group_assignments\nудаление распространяется на объект таблица group_exclusions\nудаление распространяется на объект таблица users\nудаление распространяется на объект таблица roles\nудаление распространяется на объект таблица permissions\nудаление распространяется на объект таблица user_roles\nудаление распространяется на объект таблица role_permissions\nудаление распространяется на объект таблица sessions\nудаление распространяется на объект таблица login_rate_limits\nудаление распространяется на объект таблица auth_audit_events\nудаление распространяется на объект таблица tasks\nудаление распространяется на объект таблица location_groups\nудаление распространяется на объект таблица location_group_members\nудаление распространяется на объект таблица overview_settings",
  file: "dependency.c",
  line: "1171",
  routine: "reportDependentObjects",
}
Applied 0000_initial_postgres.sql.
{
  severity_local: "ЗАМЕЧАНИЕ",
  severity: "NOTICE",
  code: "42701",
  message: "столбец \"session_version\" отношения \"users\" уже существует, пропускается",
  file: "tablecmds.c",
  line: "7682",
  routine: "check_for_column_name_collision",
}
{
  severity_local: "ЗАМЕЧАНИЕ",
  severity: "NOTICE",
  code: "42701",
  message: "столбец \"session_version\" отношения \"sessions\" уже существует, пропускается",
  file: "tablecmds.c",
  line: "7682",
  routine: "check_for_column_name_collision",
}
Applied 0001_security_hardening.sql.
Applied 0002_tasks.sql.
Applied 0003_location_groups.sql.
Applied 0004_overview_settings_and_unique_location_groups.sql.
{
  severity_local: "ЗАМЕЧАНИЕ",
  severity: "NOTICE",
  code: "42P07",
  message: "отношение \"uq_group_assignments_person_day\" уже существует, пропускается",
  file: "index.c",
  line: "894",
  routine: "index_create",
}
Applied 0005_data_integrity_normalization.sql.
{
  severity_local: "ЗАМЕЧАНИЕ",
  severity: "NOTICE",
  code: "42701",
  message: "столбец \"conscription_number\" отношения \"people\" уже существует, пропускается",
  file: "tablecmds.c",
  line: "7682",
  routine: "check_for_column_name_collision",
}
Applied 0006_person_conscription_number.sql.
Applied 0007_performance_indexes.sql.
Test database migrated and seeded.
$ bun --bun next build
▲ Next.js 16.2.10 (Turbopack)
- Environments: .env
- Experiments (use with caution):
  · proxyClientMaxBodySize: "256kb"

  Creating an optimized production build ...
✓ Compiled successfully in 5.4s
✓ Finished TypeScript in 12.0s    
✓ Collecting page data using 7 workers in 1016ms    
✓ Generating static pages using 7 workers (7/7) in 213ms
✓ Finalizing page optimization in 19ms    

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/admin/roles
├ ƒ /api/admin/users
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/auth/me
├ ƒ /api/events
├ ƒ /api/groups
├ ƒ /api/groups/assign
├ ƒ /api/groups/exclude
├ ƒ /api/groups/history
├ ƒ /api/groups/refresh
├ ƒ /api/groups/rotate
├ ƒ /api/groups/rule
├ ƒ /api/health
├ ƒ /api/location-change
├ ƒ /api/location-groups
├ ƒ /api/locations
├ ƒ /api/overview-settings
├ ƒ /api/people
├ ƒ /api/platoons
├ ƒ /api/snapshot
├ ƒ /api/tasks
├ ƒ /api/tasks/complete
└ ƒ /references


ƒ Proxy (Middleware)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


Running 32 tests using 4 workers

  ✓   1 [setup] › tests\e2e\auth.setup.ts:17:6 › authenticate test roles (1.7s)
  ✓   2 [api] › tests\e2e\api.spec.ts:16:5 › health proves database readiness without leaking details (107ms)
  ✘   3 [webkit] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out (5ms)
  ✘   4 [firefox] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out (4ms)
  ✓   5 [chromium] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out (2.0s)
  ✓   6 [api] › tests\e2e\api.spec.ts:24:5 › authentication and RBAC protect read and write surfaces (239ms)
  ✓   7 …i] › tests\e2e\api.spec.ts:43:5 › mutation boundaries reject CSRF, media type and malformed JSON (171ms)
  ✓   8 [api] › tests\e2e\api.spec.ts:69:5 › unknown location is a 404 and cannot mutate a person (372ms)
  ✓   9 [api] › tests\e2e\api.spec.ts:83:5 › excluded person cannot be assigned manually (220ms)
  ✘  10 [firefox] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section (5ms)
  ✘  11 [webkit] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section (6ms)
  ✓  12 … › tests\e2e\api.spec.ts:100:5 › tasks writer completes a full create-update-complete round trip (690ms)
  ✓  13 [api] › tests\e2e\api.spec.ts:129:5 › unsupported methods use the framework 405 contract (103ms)
  ✓  14 [chromium] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section (2.3s)
  ✘  15 …s\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations (4ms)
  ✘  16 …s\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations (6ms)
  ✘  17 [mobile-chromium] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out (6.4s)
  ✘  18 …app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations (6ms)
  ✘  19 …app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations (5ms)
  ✓  20 …\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations (1.9s)
  ✘  21 …fox] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls (4ms)
  ✘  22 …kit] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls (3ms)
  ✘  23 …efox] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls (4ms)
  ✘  24 …bkit] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls (4ms)
  ✓  25 …p.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations (845ms)
  ✓  26 …m] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls (869ms)
  ✓  27 …um] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls (719ms)
  ✓  28 …le-chromium] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section (1.9s)
  ✓  29 …\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations (1.3s)
  ✓  30 …pp.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations (1.0s)
  ✓  31 …um] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls (1.7s)
  ✓  32 …ium] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls (1.1s)

  1) [firefox] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out ───────

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-administrator-opens-the-roster-and-can-sign-out-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-administrator-opens-the-roster-and-can-sign-out-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-administrator-opens-the-roster-and-can-sign-out-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2) [firefox] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-browser-Back-returns-from-an-internal-service-section-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-browser-Back-returns-from-an-internal-service-section-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-browser-Back-returns-from-an-internal-service-section-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  3) [firefox] › tests\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  4) [firefox] › tests\e2e\app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  5) [firefox] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  6) [firefox] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\firefox-1532\firefox\firefox.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-firefox\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-firefox\trace.zip
    Usage:

        npx playwright show-trace test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-firefox\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  7) [webkit] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out ────────

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-administrator-opens-the-roster-and-can-sign-out-webkit\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-administrator-opens-the-roster-and-can-sign-out-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-administrator-opens-the-roster-and-can-sign-out-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  8) [webkit] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section ─

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-browser-Back-returns-from-an-internal-service-section-webkit\error-context.md
    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-browser-Back-returns-from-an-internal-service-section-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-browser-Back-returns-from-an-internal-service-section-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  9) [webkit] › tests\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-webkit\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-anonymous-login-shows--8229e-us-accessibility-violations-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  10) [webkit] › tests\e2e\app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-webkit\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-roster-read-only-role--27479-on-and-no-enabled-mutations-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  11) [webkit] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-webkit\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-groups-read-only-role--f4c73-oups-without-write-controls-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  12) [webkit] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls 

    Error: browserType.launch: Executable doesn't exist at C:\Users\Aquarius\AppData\Local\ms-playwright\webkit-2311\Playwright.exe
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-webkit\error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-webkit\trace.zip
    Usage:

        npx playwright show-trace test-results\app-tasks-read-only-role-l-06563-sks-without-create-controls-webkit\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  13) [mobile-chromium] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out 

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('button', { name: /Выйти/ }).first()
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByRole('button', { name: /Выйти/ }).first()


       5 |   await page.goto("/");
       6 |   await expect(page.getByLabel("Расход личного состава")).toBeVisible();
    >  7 |   await expect(page.getByRole("button", { name: /Выйти/ }).first()).toBeVisible();
         |                                                                     ^
       8 | });
       9 |
      10 | test("browser Back returns from an internal service section", async ({ page }) => {
        at C:\Users\Aquarius\Documents\rashod-next\tests\e2e\app.spec.ts:7:69

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\app-administrator-opens-the-roster-and-can-sign-out-mobile-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\app-administrator-opens-the-roster-and-can-sign-out-mobile-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\app-administrator-opens-the-roster-and-can-sign-out-mobile-chromium\error-context.md

    attachment #4: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results\app-administrator-opens-the-roster-and-can-sign-out-mobile-chromium\trace.zip
    Usage:

        npx playwright show-trace test-results\app-administrator-opens-the-roster-and-can-sign-out-mobile-chromium\trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  13 failed
    [firefox] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out ────────
    [firefox] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section ─
    [firefox] › tests\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations 
    [firefox] › tests\e2e\app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations 
    [firefox] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls 
    [firefox] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls 
    [webkit] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out ─────────
    [webkit] › tests\e2e\app.spec.ts:10:5 › browser Back returns from an internal service section ──
    [webkit] › tests\e2e\app.spec.ts:21:7 › anonymous login › shows login and has no serious accessibility violations 
    [webkit] › tests\e2e\app.spec.ts:35:7 › roster read-only role › sees only permitted navigation and no enabled mutations 
    [webkit] › tests\e2e\app.spec.ts:50:7 › groups read-only role › lands on groups without write controls 
    [webkit] › tests\e2e\app.spec.ts:60:7 › tasks read-only role › lands on tasks without create controls 
    [mobile-chromium] › tests\e2e\app.spec.ts:4:5 › administrator opens the roster and can sign out 
  19 passed (23.1s)
error: script "test:e2e:full" exited with code 1