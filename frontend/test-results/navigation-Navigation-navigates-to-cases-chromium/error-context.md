# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Navigation >> navigates to cases
- Location: e2e\navigation.spec.ts:26:3

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
    - generic [ref=e5] [cursor=pointer]: "%"
    - generic [ref=e6] [cursor=pointer]: O
    - generic [ref=e7] [cursor=pointer]: c
    - generic [ref=e8] [cursor=pointer]: "y"
    - generic [ref=e9] [cursor=pointer]: J
    - generic [ref=e10] [cursor=pointer]: "1"
    - generic [ref=e11] [cursor=pointer]: "@"
    - generic [ref=e12] [cursor=pointer]: f
    - generic [ref=e13] [cursor=pointer]: z
    - generic [ref=e14] [cursor=pointer]: p
    - generic [ref=e15] [cursor=pointer]: a
    - generic [ref=e16] [cursor=pointer]: _
    - generic [ref=e17] [cursor=pointer]: =
    - generic [ref=e18] [cursor=pointer]: V
    - generic [ref=e19] [cursor=pointer]: P
    - generic [ref=e20] [cursor=pointer]: ^
    - generic [ref=e21] [cursor=pointer]: r
    - generic [ref=e22] [cursor=pointer]: "4"
    - generic [ref=e23] [cursor=pointer]: T
    - generic [ref=e24] [cursor=pointer]: J
    - generic [ref=e25] [cursor=pointer]: "}"
    - generic [ref=e26] [cursor=pointer]: "|"
    - generic [ref=e27] [cursor=pointer]: "7"
    - generic [ref=e28] [cursor=pointer]: $
    - generic [ref=e29] [cursor=pointer]: W
    - generic [ref=e30] [cursor=pointer]: b
    - generic [ref=e31] [cursor=pointer]: V
    - generic [ref=e32] [cursor=pointer]: ^
    - generic [ref=e33] [cursor=pointer]: /
    - generic [ref=e34] [cursor=pointer]: ^
    - generic [ref=e35] [cursor=pointer]: g
    - generic [ref=e36] [cursor=pointer]: "7"
    - generic [ref=e37] [cursor=pointer]: j
    - generic [ref=e38] [cursor=pointer]: a
    - generic [ref=e39] [cursor=pointer]: "["
    - generic [ref=e40] [cursor=pointer]: L
    - generic [ref=e41] [cursor=pointer]: D
    - generic [ref=e42] [cursor=pointer]: "Y"
    - generic [ref=e43] [cursor=pointer]: /
    - generic [ref=e44] [cursor=pointer]: ^
    - generic [ref=e45] [cursor=pointer]: S
    - generic [ref=e46] [cursor=pointer]: q
    - generic [ref=e47] [cursor=pointer]: r
    - generic [ref=e48] [cursor=pointer]: I
    - generic [ref=e49] [cursor=pointer]: j
    - generic [ref=e50] [cursor=pointer]: $
    - generic [ref=e51] [cursor=pointer]: f
    - generic [ref=e52] [cursor=pointer]: "7"
    - generic [ref=e53] [cursor=pointer]: $
    - generic [ref=e54] [cursor=pointer]: "4"
    - generic [ref=e55] [cursor=pointer]: q
    - generic [ref=e56] [cursor=pointer]: s
    - generic [ref=e57] [cursor=pointer]: +
    - generic [ref=e58] [cursor=pointer]: H
    - generic [ref=e59] [cursor=pointer]: k
    - generic [ref=e60] [cursor=pointer]: "3"
    - generic [ref=e61] [cursor=pointer]: l
    - generic [ref=e62] [cursor=pointer]: Z
    - generic [ref=e63] [cursor=pointer]: X
    - generic [ref=e64] [cursor=pointer]: "0"
    - generic [ref=e65] [cursor=pointer]: e
    - generic [ref=e66] [cursor=pointer]: "n"
    - generic [ref=e67] [cursor=pointer]: ;
    - generic [ref=e68] [cursor=pointer]: d
    - generic [ref=e69] [cursor=pointer]: q
    - generic [ref=e70] [cursor=pointer]: "&"
    - generic [ref=e71] [cursor=pointer]: W
    - generic [ref=e72] [cursor=pointer]: b
    - generic [ref=e73] [cursor=pointer]: k
    - generic [ref=e74] [cursor=pointer]: I
    - generic [ref=e75] [cursor=pointer]: i
    - generic [ref=e76] [cursor=pointer]: D
    - generic [ref=e77] [cursor=pointer]: U
    - generic [ref=e78] [cursor=pointer]: U
    - generic [ref=e79] [cursor=pointer]: p
    - generic [ref=e80] [cursor=pointer]: "%"
    - generic [ref=e81] [cursor=pointer]: "]"
    - generic [ref=e82] [cursor=pointer]: r
    - generic [ref=e83] [cursor=pointer]: "#"
    - generic [ref=e84] [cursor=pointer]: "|"
    - generic [ref=e85] [cursor=pointer]: "-"
    - generic [ref=e86] [cursor=pointer]: /
    - generic [ref=e87] [cursor=pointer]: d
    - generic [ref=e88] [cursor=pointer]: "0"
    - generic [ref=e89] [cursor=pointer]: "6"
    - generic [ref=e90] [cursor=pointer]: r
    - generic [ref=e91] [cursor=pointer]: i
    - generic [ref=e92] [cursor=pointer]: "8"
    - generic [ref=e93] [cursor=pointer]: o
    - generic [ref=e94] [cursor=pointer]: "2"
    - generic [ref=e95] [cursor=pointer]: /
    - generic [ref=e96] [cursor=pointer]: "!"
    - generic [ref=e97] [cursor=pointer]: "?"
    - generic [ref=e98] [cursor=pointer]: W
    - generic [ref=e99] [cursor=pointer]: R
    - generic [ref=e100] [cursor=pointer]: G
    - generic [ref=e101] [cursor=pointer]: X
    - generic [ref=e102] [cursor=pointer]: "5"
    - generic [ref=e103] [cursor=pointer]: T
    - generic [ref=e104] [cursor=pointer]: "["
    - generic [ref=e105] [cursor=pointer]: "!"
    - generic [ref=e106] [cursor=pointer]: I
    - generic [ref=e107] [cursor=pointer]: a
    - generic [ref=e108] [cursor=pointer]: "n"
    - generic [ref=e109] [cursor=pointer]: "2"
    - generic [ref=e110] [cursor=pointer]: "!"
    - generic [ref=e111] [cursor=pointer]: "\""
    - generic [ref=e112] [cursor=pointer]: b
    - generic [ref=e113] [cursor=pointer]: D
    - generic [ref=e114] [cursor=pointer]: X
    - generic [ref=e115] [cursor=pointer]: K
    - generic [ref=e116] [cursor=pointer]: S
    - generic [ref=e117] [cursor=pointer]: /
    - generic [ref=e118] [cursor=pointer]: E
    - generic [ref=e119] [cursor=pointer]: "!"
    - generic [ref=e120] [cursor=pointer]: =
    - generic [ref=e121] [cursor=pointer]: "\""
    - generic [ref=e122] [cursor=pointer]: )
    - generic [ref=e123] [cursor=pointer]: C
    - generic [ref=e124] [cursor=pointer]: ;
    - generic [ref=e125] [cursor=pointer]: I
    - generic [ref=e126] [cursor=pointer]: )
    - generic [ref=e127] [cursor=pointer]: "N"
    - generic [ref=e128] [cursor=pointer]: e
    - generic [ref=e129] [cursor=pointer]: m
    - generic [ref=e130] [cursor=pointer]: "N"
    - generic [ref=e131] [cursor=pointer]: W
    - generic [ref=e132] [cursor=pointer]: "|"
    - generic [ref=e133] [cursor=pointer]: "\""
    - generic [ref=e134] [cursor=pointer]: O
    - generic [ref=e135] [cursor=pointer]: m
    - generic [ref=e136] [cursor=pointer]: "%"
    - generic [ref=e137] [cursor=pointer]: w
    - generic [ref=e138] [cursor=pointer]: m
    - generic [ref=e139] [cursor=pointer]: "N"
    - generic [ref=e140] [cursor=pointer]: "\""
    - generic [ref=e141] [cursor=pointer]: a
    - generic [ref=e142] [cursor=pointer]: s
    - generic [ref=e143] [cursor=pointer]: "N"
    - generic [ref=e144] [cursor=pointer]: x
    - generic [ref=e145] [cursor=pointer]: "!"
    - generic [ref=e146] [cursor=pointer]: Q
    - generic [ref=e147] [cursor=pointer]: c
    - generic [ref=e148] [cursor=pointer]: "y"
    - generic [ref=e149] [cursor=pointer]: a
    - generic [ref=e150] [cursor=pointer]: "!"
    - generic [ref=e151] [cursor=pointer]: Q
    - generic [ref=e152] [cursor=pointer]: "?"
    - generic [ref=e153] [cursor=pointer]: "|"
    - generic [ref=e154] [cursor=pointer]: s
    - generic [ref=e155] [cursor=pointer]: /
    - generic [ref=e156] [cursor=pointer]: "-"
    - generic [ref=e157] [cursor=pointer]: "7"
    - generic [ref=e158] [cursor=pointer]: "&"
    - generic [ref=e159] [cursor=pointer]: C
    - generic [ref=e160] [cursor=pointer]: "1"
    - generic [ref=e161] [cursor=pointer]: \
    - generic [ref=e162] [cursor=pointer]: "6"
    - generic [ref=e163] [cursor=pointer]: "]"
    - generic [ref=e164] [cursor=pointer]: "%"
    - generic [ref=e165] [cursor=pointer]: r
    - generic [ref=e166] [cursor=pointer]: _
    - generic [ref=e167] [cursor=pointer]: C
    - generic [ref=e168] [cursor=pointer]: u
    - generic [ref=e169] [cursor=pointer]: u
    - generic [ref=e170] [cursor=pointer]: "*"
    - generic [ref=e171] [cursor=pointer]: a
    - generic [ref=e172] [cursor=pointer]: ;
    - generic [ref=e173] [cursor=pointer]: m
    - generic [ref=e174] [cursor=pointer]: W
    - generic [ref=e175] [cursor=pointer]: "\""
    - generic [ref=e176] [cursor=pointer]: h
    - generic [ref=e177] [cursor=pointer]: +
    - generic [ref=e178] [cursor=pointer]: "@"
    - generic [ref=e179] [cursor=pointer]: W
    - generic [ref=e180] [cursor=pointer]: "{"
    - generic [ref=e181] [cursor=pointer]: q
    - generic [ref=e182] [cursor=pointer]: e
    - generic [ref=e183] [cursor=pointer]: "3"
    - generic [ref=e184] [cursor=pointer]: s
    - generic [ref=e185] [cursor=pointer]: w
    - generic [ref=e186] [cursor=pointer]: "4"
    - generic [ref=e187] [cursor=pointer]: "|"
    - generic [ref=e188] [cursor=pointer]: "n"
    - generic [ref=e189] [cursor=pointer]: A
    - generic [ref=e190] [cursor=pointer]: )
    - generic [ref=e191] [cursor=pointer]: d
    - generic [ref=e192] [cursor=pointer]: "2"
    - generic [ref=e193] [cursor=pointer]: M
    - generic [ref=e194] [cursor=pointer]: "3"
    - generic [ref=e195] [cursor=pointer]: R
    - generic [ref=e196] [cursor=pointer]: q
    - generic [ref=e197] [cursor=pointer]: r
    - generic [ref=e198] [cursor=pointer]: J
    - generic [ref=e199] [cursor=pointer]: )
    - generic [ref=e200] [cursor=pointer]: B
    - generic [ref=e201] [cursor=pointer]: D
    - generic [ref=e202] [cursor=pointer]: "-"
    - generic [ref=e203] [cursor=pointer]: I
    - generic [ref=e204] [cursor=pointer]: m
    - generic [ref=e205] [cursor=pointer]: D
    - generic [ref=e206] [cursor=pointer]: +
    - generic [ref=e207] [cursor=pointer]: C
    - generic [ref=e208] [cursor=pointer]: "["
    - generic [ref=e209] [cursor=pointer]: w
    - generic [ref=e210] [cursor=pointer]: "9"
    - generic [ref=e211] [cursor=pointer]: s
    - generic [ref=e212] [cursor=pointer]: "%"
    - generic [ref=e213] [cursor=pointer]: "|"
    - generic [ref=e214] [cursor=pointer]: "@"
    - generic [ref=e215] [cursor=pointer]: "{"
    - generic [ref=e216] [cursor=pointer]: "&"
    - generic [ref=e217] [cursor=pointer]: d
    - generic [ref=e218] [cursor=pointer]: c
    - generic [ref=e219] [cursor=pointer]: "-"
    - generic [ref=e220] [cursor=pointer]: "2"
    - generic [ref=e221] [cursor=pointer]: v
    - generic [ref=e222] [cursor=pointer]: S
    - generic [ref=e223] [cursor=pointer]: ":"
    - generic [ref=e224] [cursor=pointer]: "8"
    - generic [ref=e225] [cursor=pointer]: l
    - generic [ref=e226] [cursor=pointer]: e
    - generic [ref=e227] [cursor=pointer]: s
    - generic [ref=e228] [cursor=pointer]: "!"
    - generic [ref=e229] [cursor=pointer]: e
    - generic [ref=e230] [cursor=pointer]: "N"
    - generic [ref=e231] [cursor=pointer]: <
    - generic [ref=e232] [cursor=pointer]: A
    - generic [ref=e233] [cursor=pointer]: M
    - generic [ref=e234] [cursor=pointer]: "y"
    - generic [ref=e235] [cursor=pointer]: (
    - generic [ref=e236] [cursor=pointer]: "\""
    - generic [ref=e237] [cursor=pointer]: ;
    - generic [ref=e238] [cursor=pointer]: G
    - generic [ref=e239] [cursor=pointer]: A
    - generic [ref=e240] [cursor=pointer]: v
    - generic [ref=e241] [cursor=pointer]: "7"
    - generic [ref=e242] [cursor=pointer]: "["
    - generic [ref=e243] [cursor=pointer]: r
    - generic [ref=e244] [cursor=pointer]: D
    - generic [ref=e245] [cursor=pointer]: V
    - generic [ref=e246] [cursor=pointer]: G
    - generic [ref=e247] [cursor=pointer]: "@"
    - generic [ref=e248] [cursor=pointer]: "9"
    - generic [ref=e249] [cursor=pointer]: x
    - generic [ref=e250] [cursor=pointer]: ;
    - generic [ref=e251] [cursor=pointer]: "@"
    - generic [ref=e252] [cursor=pointer]: d
    - generic [ref=e253] [cursor=pointer]: F
    - generic [ref=e254] [cursor=pointer]: K
    - generic [ref=e255] [cursor=pointer]: )
    - generic [ref=e256] [cursor=pointer]: a
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
  3  | async function loginAs(page: import('@playwright/test').Page) {
  4  |   await page.goto('/login');
  5  |   await page.locator('input[type="email"]').fill('admin@atlas.gov');
  6  |   await page.locator('input[type="password"]').fill('admin123');
  7  |   await page.locator('button[type="submit"]').click();
> 8  |   await page.waitForURL(/\/dashboard/, { timeout: 15000 });
     |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  9  | }
  10 | 
  11 | test.describe('Navigation', () => {
  12 |   test.beforeEach(async ({ page }) => {
  13 |     await loginAs(page);
  14 |   });
  15 | 
  16 |   test('navigates to overview', async ({ page }) => {
  17 |     await page.goto('/real');
  18 |     await expect(page.locator('text=Cash-Out Risk Intelligence')).toBeVisible({ timeout: 15000 });
  19 |   });
  20 | 
  21 |   test('navigates to map', async ({ page }) => {
  22 |     await page.goto('/real/map');
  23 |     await expect(page.locator('text=Predicted Cash-Out Locations')).toBeVisible({ timeout: 15000 });
  24 |   });
  25 | 
  26 |   test('navigates to cases', async ({ page }) => {
  27 |     await page.goto('/real/cases');
  28 |     await expect(page.locator('text=Case').first()).toBeVisible({ timeout: 15000 });
  29 |   });
  30 | 
  31 |   test('navigates to data privacy', async ({ page }) => {
  32 |     await page.goto('/real/data-privacy');
  33 |     await expect(page.locator('text=Synthetic Data').first()).toBeVisible({ timeout: 15000 });
  34 |   });
  35 | 
  36 |   test('shows offline or live status', async ({ page }) => {
  37 |     await page.goto('/real');
  38 |     await page.waitForTimeout(2000);
  39 |     const status = page.locator('text=Backend Offline').or(page.locator('text=Live'));
  40 |     await expect(status.first()).toBeVisible({ timeout: 10000 });
  41 |   });
  42 | });
  43 | 
```