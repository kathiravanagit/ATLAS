# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Console Overview >> shows impact metrics
- Location: e2e\dashboard.spec.ts:44:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5] [cursor=pointer]: O
    - generic [ref=e6] [cursor=pointer]: M
    - generic [ref=e7] [cursor=pointer]: b
    - generic [ref=e8] [cursor=pointer]: "{"
    - generic [ref=e9] [cursor=pointer]: i
    - generic [ref=e10] [cursor=pointer]: e
    - generic [ref=e11] [cursor=pointer]: "n"
    - generic [ref=e12] [cursor=pointer]: O
    - generic [ref=e13] [cursor=pointer]: /
    - generic [ref=e14] [cursor=pointer]: "}"
    - generic [ref=e15] [cursor=pointer]: c
    - generic [ref=e16] [cursor=pointer]: b
    - generic [ref=e17] [cursor=pointer]: (
    - generic [ref=e18] [cursor=pointer]: t
    - generic [ref=e19] [cursor=pointer]: ">"
    - generic [ref=e20] [cursor=pointer]: _
    - generic [ref=e21] [cursor=pointer]: T
    - generic [ref=e22] [cursor=pointer]: r
    - generic [ref=e23] [cursor=pointer]: "-"
    - generic [ref=e24] [cursor=pointer]: w
    - generic [ref=e25] [cursor=pointer]: "?"
    - generic [ref=e26] [cursor=pointer]: "!"
    - generic [ref=e27] [cursor=pointer]: C
    - generic [ref=e28] [cursor=pointer]: j
    - generic [ref=e29] [cursor=pointer]: "4"
    - generic [ref=e30] [cursor=pointer]: d
    - generic [ref=e31] [cursor=pointer]: c
    - generic [ref=e32] [cursor=pointer]: "&"
    - generic [ref=e33] [cursor=pointer]: g
    - generic [ref=e34] [cursor=pointer]: "]"
    - generic [ref=e35] [cursor=pointer]: u
    - generic [ref=e36] [cursor=pointer]: "6"
    - generic [ref=e37] [cursor=pointer]: O
    - generic [ref=e38] [cursor=pointer]: "Y"
    - generic [ref=e39] [cursor=pointer]: _
    - generic [ref=e40] [cursor=pointer]: P
    - generic [ref=e41] [cursor=pointer]: "Y"
    - generic [ref=e42] [cursor=pointer]: V
    - generic [ref=e43] [cursor=pointer]: Q
    - generic [ref=e44] [cursor=pointer]: X
    - generic [ref=e45] [cursor=pointer]: L
    - generic [ref=e46] [cursor=pointer]: x
    - generic [ref=e47] [cursor=pointer]: g
    - generic [ref=e48] [cursor=pointer]: c
    - generic [ref=e49] [cursor=pointer]: x
    - generic [ref=e50] [cursor=pointer]: p
    - generic [ref=e51] [cursor=pointer]: "%"
    - generic [ref=e52] [cursor=pointer]: )
    - generic [ref=e53] [cursor=pointer]: $
    - generic [ref=e54] [cursor=pointer]: V
    - generic [ref=e55] [cursor=pointer]: ;
    - generic [ref=e56] [cursor=pointer]: E
    - generic [ref=e57] [cursor=pointer]: "@"
    - generic [ref=e58] [cursor=pointer]: c
    - generic [ref=e59] [cursor=pointer]: "}"
    - generic [ref=e60] [cursor=pointer]: "4"
    - generic [ref=e61] [cursor=pointer]: "@"
    - generic [ref=e62] [cursor=pointer]: x
    - generic [ref=e63] [cursor=pointer]: b
    - generic [ref=e64] [cursor=pointer]: l
    - generic [ref=e65] [cursor=pointer]: M
    - generic [ref=e66] [cursor=pointer]: "9"
    - generic [ref=e67] [cursor=pointer]: "2"
    - generic [ref=e68] [cursor=pointer]: a
    - generic [ref=e69] [cursor=pointer]: "6"
    - generic [ref=e70] [cursor=pointer]: /
    - generic [ref=e71] [cursor=pointer]: "5"
    - generic [ref=e72] [cursor=pointer]: "Y"
    - generic [ref=e73] [cursor=pointer]: o
    - generic [ref=e74] [cursor=pointer]: u
    - generic [ref=e75] [cursor=pointer]: r
    - generic [ref=e76] [cursor=pointer]: G
    - generic [ref=e77] [cursor=pointer]: "?"
    - generic [ref=e78] [cursor=pointer]: "|"
    - generic [ref=e79] [cursor=pointer]: "Y"
    - generic [ref=e80] [cursor=pointer]: u
    - generic [ref=e81] [cursor=pointer]: "}"
    - generic [ref=e82] [cursor=pointer]: _
    - generic [ref=e83] [cursor=pointer]: /
    - generic [ref=e84] [cursor=pointer]: L
    - generic [ref=e85] [cursor=pointer]: "%"
    - generic [ref=e86] [cursor=pointer]: "8"
    - generic [ref=e87] [cursor=pointer]: B
    - generic [ref=e88] [cursor=pointer]: "6"
    - generic [ref=e89] [cursor=pointer]: k
    - generic [ref=e90] [cursor=pointer]: A
    - generic [ref=e91] [cursor=pointer]: "N"
    - generic [ref=e92] [cursor=pointer]: Z
    - generic [ref=e93] [cursor=pointer]: "y"
    - generic [ref=e94] [cursor=pointer]: "&"
    - generic [ref=e95] [cursor=pointer]: =
    - generic [ref=e96] [cursor=pointer]: m
    - generic [ref=e97] [cursor=pointer]: K
    - generic [ref=e98] [cursor=pointer]: u
    - generic [ref=e99] [cursor=pointer]: "Y"
    - generic [ref=e100] [cursor=pointer]: b
    - generic [ref=e101] [cursor=pointer]: x
    - generic [ref=e102] [cursor=pointer]: A
    - generic [ref=e103] [cursor=pointer]: \
    - generic [ref=e104] [cursor=pointer]: _
    - generic [ref=e105] [cursor=pointer]: v
    - generic [ref=e106] [cursor=pointer]: "1"
    - generic [ref=e107] [cursor=pointer]: c
    - generic [ref=e108] [cursor=pointer]: d
    - generic [ref=e109] [cursor=pointer]: q
    - generic [ref=e110] [cursor=pointer]: "9"
    - generic [ref=e111] [cursor=pointer]: "|"
    - generic [ref=e112] [cursor=pointer]: "3"
    - generic [ref=e113] [cursor=pointer]: l
    - generic [ref=e114] [cursor=pointer]: "1"
    - generic [ref=e115] [cursor=pointer]: O
    - generic [ref=e116] [cursor=pointer]: p
    - generic [ref=e117] [cursor=pointer]: (
    - generic [ref=e118] [cursor=pointer]: K
    - generic [ref=e119] [cursor=pointer]: "7"
    - generic [ref=e120] [cursor=pointer]: <
    - generic [ref=e121] [cursor=pointer]: r
    - generic [ref=e122] [cursor=pointer]: "{"
    - generic [ref=e123] [cursor=pointer]: "}"
    - generic [ref=e124] [cursor=pointer]: T
    - generic [ref=e125] [cursor=pointer]: I
    - generic [ref=e126] [cursor=pointer]: q
    - generic [ref=e127] [cursor=pointer]: "4"
    - generic [ref=e128] [cursor=pointer]: O
    - generic [ref=e129] [cursor=pointer]: "@"
    - generic [ref=e130] [cursor=pointer]: H
    - generic [ref=e131] [cursor=pointer]: "["
    - generic [ref=e132] [cursor=pointer]: (
    - generic [ref=e133] [cursor=pointer]: "1"
    - generic [ref=e134] [cursor=pointer]: t
    - generic [ref=e135] [cursor=pointer]: "|"
    - generic [ref=e136] [cursor=pointer]: I
    - generic [ref=e137] [cursor=pointer]: O
    - generic [ref=e138] [cursor=pointer]: <
    - generic [ref=e139] [cursor=pointer]: <
    - generic [ref=e140] [cursor=pointer]: ^
    - generic [ref=e141] [cursor=pointer]: "Y"
    - generic [ref=e142] [cursor=pointer]: u
    - generic [ref=e143] [cursor=pointer]: <
    - generic [ref=e144] [cursor=pointer]: "#"
    - generic [ref=e145] [cursor=pointer]: "#"
    - generic [ref=e146] [cursor=pointer]: "-"
    - generic [ref=e147] [cursor=pointer]: _
    - generic [ref=e148] [cursor=pointer]: "N"
    - generic [ref=e149] [cursor=pointer]: V
    - generic [ref=e150] [cursor=pointer]: v
    - generic [ref=e151] [cursor=pointer]: "*"
    - generic [ref=e152] [cursor=pointer]: d
    - generic [ref=e153] [cursor=pointer]: G
    - generic [ref=e154] [cursor=pointer]: ^
    - generic [ref=e155] [cursor=pointer]: X
    - generic [ref=e156] [cursor=pointer]: m
    - generic [ref=e157] [cursor=pointer]: "-"
    - generic [ref=e158] [cursor=pointer]: "|"
    - generic [ref=e159] [cursor=pointer]: "n"
    - generic [ref=e160] [cursor=pointer]: e
    - generic [ref=e161] [cursor=pointer]: G
    - generic [ref=e162] [cursor=pointer]: T
    - generic [ref=e163] [cursor=pointer]: k
    - generic [ref=e164] [cursor=pointer]: Q
    - generic [ref=e165] [cursor=pointer]: l
    - generic [ref=e166] [cursor=pointer]: ":"
    - generic [ref=e167] [cursor=pointer]: o
    - generic [ref=e168] [cursor=pointer]: v
    - generic [ref=e169] [cursor=pointer]: h
    - generic [ref=e170] [cursor=pointer]: "0"
    - generic [ref=e171] [cursor=pointer]: l
    - generic [ref=e172] [cursor=pointer]: "!"
    - generic [ref=e173] [cursor=pointer]: "1"
    - generic [ref=e174] [cursor=pointer]: J
    - generic [ref=e175] [cursor=pointer]: q
    - generic [ref=e176] [cursor=pointer]: c
    - generic [ref=e177] [cursor=pointer]: c
    - generic [ref=e178] [cursor=pointer]: B
    - generic [ref=e179] [cursor=pointer]: e
    - generic [ref=e180] [cursor=pointer]: x
    - generic [ref=e181] [cursor=pointer]: c
    - generic [ref=e182] [cursor=pointer]: z
    - generic [ref=e183] [cursor=pointer]: "1"
    - generic [ref=e184] [cursor=pointer]: i
    - generic [ref=e185] [cursor=pointer]: J
    - generic [ref=e186] [cursor=pointer]: u
    - generic [ref=e187] [cursor=pointer]: "{"
    - generic [ref=e188] [cursor=pointer]: _
    - generic [ref=e189] [cursor=pointer]: d
    - generic [ref=e190] [cursor=pointer]: $
    - generic [ref=e191] [cursor=pointer]: ;
    - generic [ref=e192] [cursor=pointer]: "3"
    - generic [ref=e193] [cursor=pointer]: "&"
    - generic [ref=e194] [cursor=pointer]: I
    - generic [ref=e195] [cursor=pointer]: "{"
    - generic [ref=e196] [cursor=pointer]: "}"
    - generic [ref=e197] [cursor=pointer]: r
    - generic [ref=e198] [cursor=pointer]: W
    - generic [ref=e199] [cursor=pointer]: Q
    - generic [ref=e200] [cursor=pointer]: M
    - generic [ref=e201] [cursor=pointer]: C
    - generic [ref=e202] [cursor=pointer]: ;
    - generic [ref=e203] [cursor=pointer]: x
    - generic [ref=e204] [cursor=pointer]: k
    - generic [ref=e205] [cursor=pointer]: Z
    - generic [ref=e206] [cursor=pointer]: w
    - generic [ref=e207] [cursor=pointer]: L
    - generic [ref=e208] [cursor=pointer]: ":"
    - generic [ref=e209] [cursor=pointer]: "N"
    - generic [ref=e210] [cursor=pointer]: _
    - generic [ref=e211] [cursor=pointer]: T
    - generic [ref=e212] [cursor=pointer]: k
    - generic [ref=e213] [cursor=pointer]: "{"
    - generic [ref=e214] [cursor=pointer]: W
    - generic [ref=e215] [cursor=pointer]: c
    - generic [ref=e216] [cursor=pointer]: "@"
    - generic [ref=e217] [cursor=pointer]: "*"
    - generic [ref=e218] [cursor=pointer]: s
    - generic [ref=e219] [cursor=pointer]: O
    - generic [ref=e220] [cursor=pointer]: f
    - generic [ref=e221] [cursor=pointer]: U
    - generic [ref=e222] [cursor=pointer]: u
    - generic [ref=e223] [cursor=pointer]: A
    - generic [ref=e224] [cursor=pointer]: i
    - generic [ref=e225] [cursor=pointer]: =
    - generic [ref=e226] [cursor=pointer]: "4"
    - generic [ref=e227] [cursor=pointer]: "7"
    - generic [ref=e228] [cursor=pointer]: r
    - generic [ref=e229] [cursor=pointer]: m
    - generic [ref=e230] [cursor=pointer]: "@"
    - generic [ref=e231] [cursor=pointer]: p
    - generic [ref=e232] [cursor=pointer]: x
    - generic [ref=e233] [cursor=pointer]: i
    - generic [ref=e234] [cursor=pointer]: i
    - generic [ref=e235] [cursor=pointer]: t
    - generic [ref=e236] [cursor=pointer]: X
    - generic [ref=e237] [cursor=pointer]: "N"
    - generic [ref=e238] [cursor=pointer]: "1"
    - generic [ref=e239] [cursor=pointer]: A
    - generic [ref=e240] [cursor=pointer]: b
    - generic [ref=e241] [cursor=pointer]: b
    - generic [ref=e242] [cursor=pointer]: "3"
    - generic [ref=e243] [cursor=pointer]: "n"
    - generic [ref=e244] [cursor=pointer]: "["
    - generic [ref=e245] [cursor=pointer]: u
    - generic [ref=e246] [cursor=pointer]: d
    - generic [ref=e247] [cursor=pointer]: "3"
    - generic [ref=e248] [cursor=pointer]: S
    - generic [ref=e249] [cursor=pointer]: +
    - generic [ref=e250] [cursor=pointer]: i
    - generic [ref=e251] [cursor=pointer]: (
    - generic [ref=e252] [cursor=pointer]: "Y"
    - generic [ref=e253] [cursor=pointer]: A
    - generic [ref=e254] [cursor=pointer]: $
    - generic [ref=e255] [cursor=pointer]: W
    - generic [ref=e256] [cursor=pointer]: "3"
  - generic [ref=e257]:
    - generic [ref=e258]: SECURE CHANNEL
    - generic [ref=e262]:
      - img "Government Badge" [ref=e264]
      - generic [ref=e265]:
        - heading "ATLAS" [level=1] [ref=e266]
        - paragraph [ref=e267]: Advanced Threat Location & Alert System — Law Enforcement Portal
      - generic [ref=e268]: Invalid credentials
      - generic [ref=e269]:
        - generic [ref=e270]:
          - generic [ref=e271]: Email
          - textbox "investigator@cybercrime.gov.in" [ref=e276]: admin@atlas.gov
        - generic [ref=e277]:
          - generic [ref=e278]: Password
          - generic [ref=e279]:
            - textbox "••••••••••" [ref=e283]: admin123
            - button [ref=e284] [cursor=pointer]
        - button "Sign In" [ref=e288] [cursor=pointer]
      - generic [ref=e291]:
        - text: New official?
        - link "Register here" [ref=e292] [cursor=pointer]:
          - /url: /register
      - generic [ref=e293]:
        - generic [ref=e294]: Quick Demo Login
        - generic [ref=e295]:
          - button "Inspector inspector@atlas.gov" [ref=e296] [cursor=pointer]:
            - generic [ref=e297]: Inspector
            - generic [ref=e298]: inspector@atlas.gov
          - button "Analyst analyst@atlas.gov" [ref=e299] [cursor=pointer]:
            - generic [ref=e300]: Analyst
            - generic [ref=e301]: analyst@atlas.gov
          - button "Bank Officer bank@atlas.gov" [ref=e302] [cursor=pointer]:
            - generic [ref=e303]: Bank Officer
            - generic [ref=e304]: bank@atlas.gov
          - button "Admin admin@atlas.gov" [ref=e305] [cursor=pointer]:
            - generic [ref=e306]: Admin
            - generic [ref=e307]: admin@atlas.gov
    - generic [ref=e308]:
      - generic [ref=e309]:
        - generic [ref=e310]: Ministry of Home Affairs
        - generic [ref=e312]: National Cybercrime Reporting Portal
      - paragraph [ref=e313]: Officials only · All access is monitored and logged
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Dashboard Welcome Page', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await page.locator('input[type="email"]').fill('admin@atlas.gov');
  7  |     await page.locator('input[type="password"]').fill('admin123');
  8  |     await page.locator('button[type="submit"]').click();
  9  |     await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  10 |   });
  11 | 
  12 |   test('redirects to dashboard after login', async ({ page }) => {
  13 |     await expect(page).toHaveURL(/\/dashboard/);
  14 |   });
  15 | 
  16 |   test('shows welcome content', async ({ page }) => {
  17 |     await expect(page.locator('text=Welcome').or(page.locator('text=Investigator')).first()).toBeVisible({ timeout: 10000 });
  18 |   });
  19 | 
  20 |   test('has link to enter console', async ({ page }) => {
  21 |     const enterBtn = page.locator('text=Enter Console').or(page.locator('text=Investigator Console')).first();
  22 |     await expect(enterBtn).toBeVisible({ timeout: 10000 });
  23 |   });
  24 | });
  25 | 
  26 | test.describe('Console Overview', () => {
  27 |   test.beforeEach(async ({ page }) => {
  28 |     await page.goto('/login');
  29 |     await page.locator('input[type="email"]').fill('admin@atlas.gov');
  30 |     await page.locator('input[type="password"]').fill('admin123');
  31 |     await page.locator('button[type="submit"]').click();
> 32 |     await page.waitForURL(/\/dashboard/, { timeout: 15000 });
     |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  33 |     await page.goto('/real');
  34 |     await page.waitForTimeout(3000);
  35 |   });
  36 | 
  37 |   test('shows stat cards', async ({ page }) => {
  38 |     await expect(page.locator('text=Active Cases')).toBeVisible({ timeout: 10000 });
  39 |     await expect(page.locator('text=High-Risk Locations')).toBeVisible();
  40 |     await expect(page.locator('text=Alerts Today')).toBeVisible();
  41 |     await expect(page.locator('text=Avg. Lead Time')).toBeVisible();
  42 |   });
  43 | 
  44 |   test('shows impact metrics', async ({ page }) => {
  45 |     await expect(page.locator('text=Prevented Fraud')).toBeVisible({ timeout: 10000 });
  46 |     await expect(page.locator('text=Mules Flagged')).toBeVisible();
  47 |   });
  48 | 
  49 |   test('shows prediction card', async ({ page }) => {
  50 |     await expect(page.locator('text=Predicted Cash-Out Location')).toBeVisible({ timeout: 10000 });
  51 |   });
  52 | 
  53 |   test('shows demo mode indicator', async ({ page }) => {
  54 |     await expect(page.locator('text=Demo Mode')).toBeVisible({ timeout: 10000 });
  55 |   });
  56 | 
  57 |   test('shows user profile in TopNav', async ({ page }) => {
  58 |     await expect(page.locator('text=Admin').first()).toBeVisible({ timeout: 10000 });
  59 |   });
  60 | });
  61 | 
```