# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: predictions.spec.ts >> Simulate Transaction >> shows simulate transaction section
- Location: e2e\predictions.spec.ts:18:3

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
    - generic [ref=e5] [cursor=pointer]: "4"
    - generic [ref=e6] [cursor=pointer]: )
    - generic [ref=e7] [cursor=pointer]: "{"
    - generic [ref=e8] [cursor=pointer]: F
    - generic [ref=e9] [cursor=pointer]: "2"
    - generic [ref=e10] [cursor=pointer]: ;
    - generic [ref=e11] [cursor=pointer]: q
    - generic [ref=e12] [cursor=pointer]: \
    - generic [ref=e13] [cursor=pointer]: "["
    - generic [ref=e14] [cursor=pointer]: r
    - generic [ref=e15] [cursor=pointer]: D
    - generic [ref=e16] [cursor=pointer]: "n"
    - generic [ref=e17] [cursor=pointer]: I
    - generic [ref=e18] [cursor=pointer]: \
    - generic [ref=e19] [cursor=pointer]: X
    - generic [ref=e20] [cursor=pointer]: "!"
    - generic [ref=e21] [cursor=pointer]: ;
    - generic [ref=e22] [cursor=pointer]: $
    - generic [ref=e23] [cursor=pointer]: "0"
    - generic [ref=e24] [cursor=pointer]: a
    - generic [ref=e25] [cursor=pointer]: l
    - generic [ref=e26] [cursor=pointer]: D
    - generic [ref=e27] [cursor=pointer]: j
    - generic [ref=e28] [cursor=pointer]: V
    - generic [ref=e29] [cursor=pointer]: I
    - generic [ref=e30] [cursor=pointer]: "y"
    - generic [ref=e31] [cursor=pointer]: G
    - generic [ref=e32] [cursor=pointer]: C
    - generic [ref=e33] [cursor=pointer]: B
    - generic [ref=e34] [cursor=pointer]: Z
    - generic [ref=e35] [cursor=pointer]: b
    - generic [ref=e36] [cursor=pointer]: "{"
    - generic [ref=e37] [cursor=pointer]: X
    - generic [ref=e38] [cursor=pointer]: z
    - generic [ref=e39] [cursor=pointer]: Q
    - generic [ref=e40] [cursor=pointer]: f
    - generic [ref=e41] [cursor=pointer]: $
    - generic [ref=e42] [cursor=pointer]: R
    - generic [ref=e43] [cursor=pointer]: Q
    - generic [ref=e44] [cursor=pointer]: W
    - generic [ref=e45] [cursor=pointer]: "{"
    - generic [ref=e46] [cursor=pointer]: "!"
    - generic [ref=e47] [cursor=pointer]: g
    - generic [ref=e48] [cursor=pointer]: "1"
    - generic [ref=e49] [cursor=pointer]: w
    - generic [ref=e50] [cursor=pointer]: "1"
    - generic [ref=e51] [cursor=pointer]: d
    - generic [ref=e52] [cursor=pointer]: U
    - generic [ref=e53] [cursor=pointer]: "*"
    - generic [ref=e54] [cursor=pointer]: M
    - generic [ref=e55] [cursor=pointer]: "4"
    - generic [ref=e56] [cursor=pointer]: S
    - generic [ref=e57] [cursor=pointer]: l
    - generic [ref=e58] [cursor=pointer]: f
    - generic [ref=e59] [cursor=pointer]: _
    - generic [ref=e60] [cursor=pointer]: ">"
    - generic [ref=e61] [cursor=pointer]: K
    - generic [ref=e62] [cursor=pointer]: "%"
    - generic [ref=e63] [cursor=pointer]: G
    - generic [ref=e64] [cursor=pointer]: "6"
    - generic [ref=e65] [cursor=pointer]: <
    - generic [ref=e66] [cursor=pointer]: "n"
    - generic [ref=e67] [cursor=pointer]: j
    - generic [ref=e68] [cursor=pointer]: M
    - generic [ref=e69] [cursor=pointer]: "%"
    - generic [ref=e70] [cursor=pointer]: U
    - generic [ref=e71] [cursor=pointer]: Q
    - generic [ref=e72] [cursor=pointer]: "["
    - generic [ref=e73] [cursor=pointer]: /
    - generic [ref=e74] [cursor=pointer]: s
    - generic [ref=e75] [cursor=pointer]: t
    - generic [ref=e76] [cursor=pointer]: "\""
    - generic [ref=e77] [cursor=pointer]: $
    - generic [ref=e78] [cursor=pointer]: a
    - generic [ref=e79] [cursor=pointer]: "8"
    - generic [ref=e80] [cursor=pointer]: t
    - generic [ref=e81] [cursor=pointer]: S
    - generic [ref=e82] [cursor=pointer]: =
    - generic [ref=e83] [cursor=pointer]: "n"
    - generic [ref=e84] [cursor=pointer]: <
    - generic [ref=e85] [cursor=pointer]: j
    - generic [ref=e86] [cursor=pointer]: (
    - generic [ref=e87] [cursor=pointer]: m
    - generic [ref=e88] [cursor=pointer]: ">"
    - generic [ref=e89] [cursor=pointer]: ">"
    - generic [ref=e90] [cursor=pointer]: q
    - generic [ref=e91] [cursor=pointer]: z
    - generic [ref=e92] [cursor=pointer]: "-"
    - generic [ref=e93] [cursor=pointer]: $
    - generic [ref=e94] [cursor=pointer]: g
    - generic [ref=e95] [cursor=pointer]: "@"
    - generic [ref=e96] [cursor=pointer]: _
    - generic [ref=e97] [cursor=pointer]: w
    - generic [ref=e98] [cursor=pointer]: w
    - generic [ref=e99] [cursor=pointer]: ;
    - generic [ref=e100] [cursor=pointer]: X
    - generic [ref=e101] [cursor=pointer]: M
    - generic [ref=e102] [cursor=pointer]: D
    - generic [ref=e103] [cursor=pointer]: t
    - generic [ref=e104] [cursor=pointer]: "n"
    - generic [ref=e105] [cursor=pointer]: d
    - generic [ref=e106] [cursor=pointer]: "@"
    - generic [ref=e107] [cursor=pointer]: c
    - generic [ref=e108] [cursor=pointer]: "@"
    - generic [ref=e109] [cursor=pointer]: "%"
    - generic [ref=e110] [cursor=pointer]: k
    - generic [ref=e111] [cursor=pointer]: f
    - generic [ref=e112] [cursor=pointer]: (
    - generic [ref=e113] [cursor=pointer]: m
    - generic [ref=e114] [cursor=pointer]: k
    - generic [ref=e115] [cursor=pointer]: I
    - generic [ref=e116] [cursor=pointer]: W
    - generic [ref=e117] [cursor=pointer]: H
    - generic [ref=e118] [cursor=pointer]: ">"
    - generic [ref=e119] [cursor=pointer]: B
    - generic [ref=e120] [cursor=pointer]: V
    - generic [ref=e121] [cursor=pointer]: u
    - generic [ref=e122] [cursor=pointer]: "|"
    - generic [ref=e123] [cursor=pointer]: h
    - generic [ref=e124] [cursor=pointer]: q
    - generic [ref=e125] [cursor=pointer]: c
    - generic [ref=e126] [cursor=pointer]: W
    - generic [ref=e127] [cursor=pointer]: c
    - generic [ref=e128] [cursor=pointer]: "Y"
    - generic [ref=e129] [cursor=pointer]: ":"
    - generic [ref=e130] [cursor=pointer]: g
    - generic [ref=e131] [cursor=pointer]: c
    - generic [ref=e132] [cursor=pointer]: "?"
    - generic [ref=e133] [cursor=pointer]: u
    - generic [ref=e134] [cursor=pointer]: G
    - generic [ref=e135] [cursor=pointer]: "2"
    - generic [ref=e136] [cursor=pointer]: "#"
    - generic [ref=e137] [cursor=pointer]: F
    - generic [ref=e138] [cursor=pointer]: G
    - generic [ref=e139] [cursor=pointer]: e
    - generic [ref=e140] [cursor=pointer]: X
    - generic [ref=e141] [cursor=pointer]: w
    - generic [ref=e142] [cursor=pointer]: x
    - generic [ref=e143] [cursor=pointer]: "-"
    - generic [ref=e144] [cursor=pointer]: e
    - generic [ref=e145] [cursor=pointer]: "N"
    - generic [ref=e146] [cursor=pointer]: h
    - generic [ref=e147] [cursor=pointer]: ;
    - generic [ref=e148] [cursor=pointer]: m
    - generic [ref=e149] [cursor=pointer]: S
    - generic [ref=e150] [cursor=pointer]: Q
    - generic [ref=e151] [cursor=pointer]: "-"
    - generic [ref=e152] [cursor=pointer]: o
    - generic [ref=e153] [cursor=pointer]: "{"
    - generic [ref=e154] [cursor=pointer]: K
    - generic [ref=e155] [cursor=pointer]: "}"
    - generic [ref=e156] [cursor=pointer]: w
    - generic [ref=e157] [cursor=pointer]: "|"
    - generic [ref=e158] [cursor=pointer]: "4"
    - generic [ref=e159] [cursor=pointer]: Q
    - generic [ref=e160] [cursor=pointer]: X
    - generic [ref=e161] [cursor=pointer]: t
    - generic [ref=e162] [cursor=pointer]: O
    - generic [ref=e163] [cursor=pointer]: s
    - generic [ref=e164] [cursor=pointer]: "9"
    - generic [ref=e165] [cursor=pointer]: O
    - generic [ref=e166] [cursor=pointer]: "|"
    - generic [ref=e167] [cursor=pointer]: \
    - generic [ref=e168] [cursor=pointer]: "4"
    - generic [ref=e169] [cursor=pointer]: j
    - generic [ref=e170] [cursor=pointer]: W
    - generic [ref=e171] [cursor=pointer]: i
    - generic [ref=e172] [cursor=pointer]: "4"
    - generic [ref=e173] [cursor=pointer]: S
    - generic [ref=e174] [cursor=pointer]: /
    - generic [ref=e175] [cursor=pointer]: "0"
    - generic [ref=e176] [cursor=pointer]: "6"
    - generic [ref=e177] [cursor=pointer]: +
    - generic [ref=e178] [cursor=pointer]: "0"
    - generic [ref=e179] [cursor=pointer]: F
    - generic [ref=e180] [cursor=pointer]: P
    - generic [ref=e181] [cursor=pointer]: o
    - generic [ref=e182] [cursor=pointer]: "["
    - generic [ref=e183] [cursor=pointer]: =
    - generic [ref=e184] [cursor=pointer]: Z
    - generic [ref=e185] [cursor=pointer]: "&"
    - generic [ref=e186] [cursor=pointer]: v
    - generic [ref=e187] [cursor=pointer]: T
    - generic [ref=e188] [cursor=pointer]: ">"
    - generic [ref=e189] [cursor=pointer]: "7"
    - generic [ref=e190] [cursor=pointer]: l
    - generic [ref=e191] [cursor=pointer]: m
    - generic [ref=e192] [cursor=pointer]: $
    - generic [ref=e193] [cursor=pointer]: D
    - generic [ref=e194] [cursor=pointer]: "%"
    - generic [ref=e195] [cursor=pointer]: /
    - generic [ref=e196] [cursor=pointer]: ">"
    - generic [ref=e197] [cursor=pointer]: =
    - generic [ref=e198] [cursor=pointer]: E
    - generic [ref=e199] [cursor=pointer]: _
    - generic [ref=e200] [cursor=pointer]: e
    - generic [ref=e201] [cursor=pointer]: "0"
    - generic [ref=e202] [cursor=pointer]: "?"
    - generic [ref=e203] [cursor=pointer]: "%"
    - generic [ref=e204] [cursor=pointer]: "2"
    - generic [ref=e205] [cursor=pointer]: "@"
    - generic [ref=e206] [cursor=pointer]: M
    - generic [ref=e207] [cursor=pointer]: ">"
    - generic [ref=e208] [cursor=pointer]: R
    - generic [ref=e209] [cursor=pointer]: z
    - generic [ref=e210] [cursor=pointer]: g
    - generic [ref=e211] [cursor=pointer]: V
    - generic [ref=e212] [cursor=pointer]: $
    - generic [ref=e213] [cursor=pointer]: )
    - generic [ref=e214] [cursor=pointer]: "%"
    - generic [ref=e215] [cursor=pointer]: w
    - generic [ref=e216] [cursor=pointer]: H
    - generic [ref=e217] [cursor=pointer]: "3"
    - generic [ref=e218] [cursor=pointer]: $
    - generic [ref=e219] [cursor=pointer]: J
    - generic [ref=e220] [cursor=pointer]: v
    - generic [ref=e221] [cursor=pointer]: =
    - generic [ref=e222] [cursor=pointer]: "["
    - generic [ref=e223] [cursor=pointer]: F
    - generic [ref=e224] [cursor=pointer]: "8"
    - generic [ref=e225] [cursor=pointer]: "#"
    - generic [ref=e226] [cursor=pointer]: S
    - generic [ref=e227] [cursor=pointer]: "["
    - generic [ref=e228] [cursor=pointer]: "N"
    - generic [ref=e229] [cursor=pointer]: ">"
    - generic [ref=e230] [cursor=pointer]: u
    - generic [ref=e231] [cursor=pointer]: K
    - generic [ref=e232] [cursor=pointer]: x
    - generic [ref=e233] [cursor=pointer]: "?"
    - generic [ref=e234] [cursor=pointer]: r
    - generic [ref=e235] [cursor=pointer]: "N"
    - generic [ref=e236] [cursor=pointer]: u
    - generic [ref=e237] [cursor=pointer]: W
    - generic [ref=e238] [cursor=pointer]: J
    - generic [ref=e239] [cursor=pointer]: k
    - generic [ref=e240] [cursor=pointer]: "#"
    - generic [ref=e241] [cursor=pointer]: ;
    - generic [ref=e242] [cursor=pointer]: T
    - generic [ref=e243] [cursor=pointer]: C
    - generic [ref=e244] [cursor=pointer]: p
    - generic [ref=e245] [cursor=pointer]: D
    - generic [ref=e246] [cursor=pointer]: m
    - generic [ref=e247] [cursor=pointer]: J
    - generic [ref=e248] [cursor=pointer]: M
    - generic [ref=e249] [cursor=pointer]: ^
    - generic [ref=e250] [cursor=pointer]: "8"
    - generic [ref=e251] [cursor=pointer]: ^
    - generic [ref=e252] [cursor=pointer]: J
    - generic [ref=e253] [cursor=pointer]: "*"
    - generic [ref=e254] [cursor=pointer]: l
    - generic [ref=e255] [cursor=pointer]: "]"
    - generic [ref=e256] [cursor=pointer]: "#"
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
  11 | test.describe('Simulate Transaction', () => {
  12 |   test.beforeEach(async ({ page }) => {
  13 |     await loginAs(page);
  14 |     await page.goto('/real/predictions');
  15 |     await page.waitForTimeout(3000);
  16 |   });
  17 | 
  18 |   test('shows simulate transaction section', async ({ page }) => {
  19 |     const heading = page.locator('text=Simulate').first();
  20 |     await expect(heading).toBeVisible({ timeout: 10000 });
  21 |   });
  22 | 
  23 |   test('shows ephemeral disclaimer', async ({ page }) => {
  24 |     await expect(page.locator('text=ephemeral')).toBeVisible({ timeout: 10000 });
  25 |   });
  26 | });
  27 | 
```