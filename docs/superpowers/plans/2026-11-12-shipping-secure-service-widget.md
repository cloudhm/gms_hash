# Shipping Secure Service Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 gooval 购物车页用私有 App Script Tag 插入 Shipping Secure Service 区块：按环境变量费率向上挂已有虚拟商品价档，主按钮带保障结账，下方 Checkout without protection。

**Architecture:** Node 服务读 `.env`，启动时拉保障商品 variants 并缓存；对外只提供无密钥的 `GET /widget/config` 与 `GET /widget.js`。购物车页脚本用店匠 Ajax `GET/POST/PATCH/DELETE {root}/api/cart` 同步 1 件正确档变体，并拦截原生 Checkout。Script Tag 用 OpenAPI `POST /openapi/2026-07/script_tags`、`display_scope=cart` 注册。

**Tech Stack:** Node.js 20+（内置 `node:test` / `node:assert`）、无框架 HTTP（`node:http`）、dotenv、店匠 OpenAPI 2026-07、店匠 Cart Ajax API。

## Global Constraints

- 费率只读 `PROTECTION_RATE`，可保上限只读 `PROTECTION_MAX_COVERED`；`fee_cap = MAX_COVERED * RATE`，不另配环境变量。
- 保障商品已存在：id `7c811a80-72f8-4972-9305-f32ecf8d35db`，handle `gwofy-shipping-protection-qaqwer`；不新建商品。
- 浏览器不得出现 `TOKEN` / `APP_SECRET` / `APP_UID`。
- 不改主题 Liquid；Script Tag 不得使用 `checkout` / `thank_you` / `all`。
- 购物车该商品始终数量 1、仅一个变体。
- 拉配置失败时不拦截原生 Checkout。
- 回复与注释对用户用中文；代码标识符用英文。

## File map

- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Create: `src/config.js` — 解析并校验环境变量
- Create: `src/pricing.js` — `eligibleSubtotal` / `pickVariant`
- Create: `src/catalog.js` — OpenAPI 拉 variants，内存缓存
- Create: `src/scriptTag.js` — 注册 cart script tag
- Create: `src/server.js` — HTTP：`/widget.js`、`/widget/config`、健康检查
- Create: `public/widget.js` — 购物车 UI + Ajax 同步
- Create: `test/config.test.js`
- Create: `test/pricing.test.js`
- Modify: `.env` — 补 `PROTECTION_PRODUCT_ID`、`PROTECTION_HANDLE`、`PUBLIC_BASE_URL`、`SHOP_DOMAIN`（已有 RATE / MAX_COVERED / TOKEN）

---

### Task 1: 项目骨架与配置校验

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `package.json`
- Create: `src/config.js`
- Create: `test/config.test.js`
- Modify: `.env`

**Interfaces:**
- Consumes: `process.env`
- Produces: `loadConfig(env = process.env) => { shopDomain, token, apiVersion, publicBaseUrl, protectionProductId, protectionHandle, rate, maxCovered, feeCap }`；非法时 `throw Error`

- [ ] **Step 1: Write failing tests**

```js
// test/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

const base = {
  SHOP_DOMAIN: 'gooval.myshoplaza.com',
  TOKEN: 'tok',
  WEBHOOK_API_VERSION: '2026-07',
  PUBLIC_BASE_URL: 'https://example.com',
  PROTECTION_PRODUCT_ID: '7c811a80-72f8-4972-9305-f32ecf8d35db',
  PROTECTION_HANDLE: 'gwofy-shipping-protection-qaqwer',
  PROTECTION_RATE: '0.02',
  PROTECTION_MAX_COVERED: '2505',
};

test('parses rate, max covered, and fee cap', () => {
  const c = loadConfig(base);
  assert.equal(c.rate, 0.02);
  assert.equal(c.maxCovered, 2505);
  assert.equal(c.feeCap, 50.1);
});

test('throws when PROTECTION_RATE missing', () => {
  const env = { ...base };
  delete env.PROTECTION_RATE;
  assert.throws(() => loadConfig(env), /PROTECTION_RATE/);
});

test('throws when PROTECTION_RATE is not a number', () => {
  assert.throws(() => loadConfig({ ...base, PROTECTION_RATE: 'abc' }), /PROTECTION_RATE/);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test test/config.test.js`  
Expected: `ERR_MODULE_NOT_FOUND` for `../src/config.js`

- [ ] **Step 3: Implement config + skeleton files**

`.gitignore`:

```
node_modules/
.env
```

`package.json`:

```json
{
  "name": "shipping-secure-service",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "start": "node --env-file=.env src/server.js",
    "register-script": "node --env-file=.env src/scriptTag.js"
  }
}
```

`src/config.js`:

```js
function num(env, key) {
  const raw = env[key];
  if (raw === undefined || raw === '') throw new Error(`missing ${key}`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`invalid ${key}`);
  return n;
}

function str(env, key) {
  const raw = (env[key] || '').trim();
  if (!raw) throw new Error(`missing ${key}`);
  return raw.replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const rate = num(env, 'PROTECTION_RATE');
  const maxCovered = num(env, 'PROTECTION_MAX_COVERED');
  return {
    shopDomain: str(env, 'SHOP_DOMAIN'),
    token: str(env, 'TOKEN'),
    apiVersion: env.WEBHOOK_API_VERSION || '2026-07',
    publicBaseUrl: str(env, 'PUBLIC_BASE_URL'),
    protectionProductId: str(env, 'PROTECTION_PRODUCT_ID'),
    protectionHandle: str(env, 'PROTECTION_HANDLE'),
    rate,
    maxCovered,
    feeCap: rate * maxCovered,
  };
}
```

`.env.example`（无密钥）：

```
SHOP_DOMAIN=gooval.myshoplaza.com
TOKEN=
APP_UID=
APP_SECRET=
WEBHOOK_API_VERSION=2026-07
PUBLIC_BASE_URL=https://your-public-host
PROTECTION_PRODUCT_ID=7c811a80-72f8-4972-9305-f32ecf8d35db
PROTECTION_HANDLE=gwofy-shipping-protection-qaqwer
PROTECTION_RATE=0.02
PROTECTION_MAX_COVERED=2505
```

在现有 `.env` 追加（不要改已有 TOKEN）：

```
SHOP_DOMAIN=gooval.myshoplaza.com
PUBLIC_BASE_URL=http://127.0.0.1:8787
PROTECTION_PRODUCT_ID=7c811a80-72f8-4972-9305-f32ecf8d35db
PROTECTION_HANDLE=gwofy-shipping-protection-qaqwer
```

`PUBLIC_BASE_URL` 在本地开发先填稍后隧道地址；注册 Script Tag 前必须是店匠能拉取的 HTTPS URL。

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test test/config.test.js`  
Expected: 3 passing

- [ ] **Step 5: Commit（仅当用户要求提交时）**

```bash
git add .gitignore .env.example package.json src/config.js test/config.test.js
git commit -m "$(cat <<'EOF'
Add env-backed app config for shipping protection rate and coverage cap.

EOF
)"
```

---

### Task 2: 计费与挂档

**Files:**
- Create: `src/pricing.js`
- Create: `test/pricing.test.js`

**Interfaces:**
- Consumes: `{ productId, rate, maxCovered }` 与 `{ product_id, final_line_price|line_price }[]`、`{ id, price }[]`
- Produces:
  - `eligibleSubtotal(lineItems, productId) => number`
  - `pickVariant({ subtotal, rate, maxCovered, variants }) => { variant, raw, cap, covered } | null`

用 `final_line_price`（字符串）优先，没有则用 `line_price`。

- [ ] **Step 1: Write failing tests**

```js
// test/pricing.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleSubtotal, pickVariant } from '../src/pricing.js';

const PID = '7c811a80-72f8-4972-9305-f32ecf8d35db';
const tiers = [
  { id: 'v1', price: 0.98 },
  { id: 'v2', price: 1.15 },
  { id: 'v5', price: 2.05 },
  { id: 'v65', price: 49.48 },
  { id: 'v66', price: 55.03 },
];
const opts = { rate: 0.02, maxCovered: 2505, variants: tiers };

test('excludes protection lines from subtotal', () => {
  const n = eligibleSubtotal([
    { product_id: 'other', final_line_price: '50.00' },
    { product_id: PID, final_line_price: '1.15' },
  ], PID);
  assert.equal(n, 50);
});

test('empty or protection-only cart is 0', () => {
  assert.equal(eligibleSubtotal([], PID), 0);
  assert.equal(eligibleSubtotal([{ product_id: PID, line_price: '1.15' }], PID), 0);
});

test('$50 maps to $1.15 tier', () => {
  const r = pickVariant({ subtotal: 50, ...opts });
  assert.equal(r.variant.id, 'v2');
  assert.equal(r.raw, 1);
});

test('exact tier price does not round up', () => {
  const r = pickVariant({ subtotal: 2.05 / 0.02, ...opts });
  assert.equal(r.variant.price, 2.05);
});

test('cap uses S0065 not S0066', () => {
  const r = pickVariant({ subtotal: 9999, ...opts });
  assert.equal(r.covered, 2505);
  assert.equal(r.cap, 50.1);
  assert.equal(r.variant.price, 49.48);
});

test('returns null when no variants under cap', () => {
  const r = pickVariant({
    subtotal: 50,
    rate: 0.02,
    maxCovered: 2505,
    variants: [{ id: 'x', price: 999 }],
  });
  assert.equal(r, null);
});

test('returns null when subtotal is 0', () => {
  assert.equal(pickVariant({ subtotal: 0, ...opts }), null);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test test/pricing.test.js`  
Expected: module not found

- [ ] **Step 3: Implement**

```js
// src/pricing.js
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function eligibleSubtotal(lineItems, productId) {
  let sum = 0;
  for (const line of lineItems || []) {
    if (line.product_id === productId) continue;
    const amt = line.final_line_price ?? line.line_price ?? 0;
    sum += money(amt);
  }
  return Math.round(sum * 100) / 100;
}

export function pickVariant({ subtotal, rate, maxCovered, variants }) {
  if (!(subtotal > 0) || !variants?.length) return null;
  const covered = Math.min(subtotal, maxCovered);
  const raw = covered * rate;
  const cap = maxCovered * rate;
  const eligible = variants
    .map((v) => ({ ...v, price: money(v.price) }))
    .filter((v) => v.price <= cap)
    .sort((a, b) => a.price - b.price);
  if (!eligible.length) return null;
  const variant = eligible.find((v) => v.price >= raw) || eligible[eligible.length - 1];
  return { variant, raw, cap, covered };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test test/pricing.test.js`  
Expected: all passing

- [ ] **Step 5: Commit if requested**

```bash
git add src/pricing.js test/pricing.test.js
git commit -m "$(cat <<'EOF'
Add protection fee rounding onto variant price tiers with coverage cap.

EOF
)"
```

---

### Task 3: 价档缓存与 Config HTTP

**Files:**
- Create: `src/catalog.js`
- Create: `src/server.js`
- Create: `public/widget.js`（本任务只放空文件或注释头，下一任务写逻辑）

**Interfaces:**
- Consumes: `loadConfig()`, `https://{shopDomain}/openapi/{apiVersion}/products/{id}`，header `Access-Token`
- Produces:
  - `fetchVariants(config) => [{ id, sku, price }]`
  - `createCatalog(config) => { getPublicConfig(): Promise<{ productId, rate, maxCovered, feeCap, variants }> }`
  - HTTP `GET /widget/config` → JSON；`GET /widget.js` → `public/widget.js`；`GET /health` → `{ok:true}`
  - 监听 `process.env.PORT || 8787`

- [ ] **Step 1: Implement catalog fetch**

```js
// src/catalog.js
export async function fetchVariants(config) {
  const url = `https://${config.shopDomain}/openapi/${config.apiVersion}/products/${config.protectionProductId}`;
  const res = await fetch(url, { headers: { 'Access-Token': config.token } });
  if (!res.ok) throw new Error(`product fetch ${res.status}`);
  const body = await res.json();
  const product = body.data?.product || body.data;
  const variants = (product.variants || []).map((v) => ({
    id: v.id,
    sku: v.sku,
    price: Number(v.price),
  }));
  if (!variants.length) throw new Error('no protection variants');
  return variants;
}

export function createCatalog(config, loader = fetchVariants) {
  let cache = null;
  return {
    async getPublicConfig() {
      if (!cache) cache = await loader(config);
      return {
        productId: config.protectionProductId,
        rate: config.rate,
        maxCovered: config.maxCovered,
        feeCap: config.feeCap,
        variants: cache,
      };
    },
  };
}
```

`src/server.js`：用 `node:http` 读 `public/widget.js`；`/widget/config` 调 `catalog.getPublicConfig()`，失败返回 500 JSON `{error}`（widget 侧视为配置失败，不拦截结账）。CORS：`Access-Control-Allow-Origin: *`（script 跨域拉 config）。

最小路由：

```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createCatalog } from './catalog.js';

const config = loadConfig();
const catalog = createCatalog(config);
const widgetPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'widget.js');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/widget/config') {
    try {
      const data = await catalog.getPublicConfig();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err.message) }));
    }
    return;
  }
  if (url.pathname === '/widget.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.end(fs.readFileSync(widgetPath));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => console.log(`listening ${port}`));
```

先写 `public/widget.js` 为 `console.debug('sss widget loaded');`

- [ ] **Step 2: Manual verify catalog against live store**

Run: `node --env-file=.env -e "import {loadConfig} from './src/config.js'; import {fetchVariants} from './src/catalog.js'; const v=await fetchVariants(loadConfig()); console.log(v.length, v[0], v.at(-1));"`  
Expected: `98` 且首档 price `0.98`、末档 `359`

- [ ] **Step 3: Start server and curl**

Run: `node --env-file=.env src/server.js`  
Then: `curl -s http://127.0.0.1:8787/widget/config | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['rate'], d['maxCovered'], len(d['variants']))"`  
Expected: `0.02 2505 98`  
Then: `curl -sI http://127.0.0.1:8787/widget.js` 含 `application/javascript`

- [ ] **Step 4: Commit if requested**

```bash
git add src/catalog.js src/server.js public/widget.js
git commit -m "$(cat <<'EOF'
Serve public widget config from cached protection variants.

EOF
)"
```

---

### Task 4: 购物车 Widget UI 与 Ajax 同步

**Files:**
- Modify: `public/widget.js`（完整实现）

**Interfaces:**
- Consumes: `GET {PUBLIC_BASE_URL}/widget/config`；店匠 `window.SHOPLAZZA.routes.root + '/api/cart'`
- Produces: 页面上 `#sss-widget`；函数 `syncCart(wantProtection)`、`goCheckout({ withProtection })`

Cart Ajax（locale 用 `window.SHOPLAZZA.routes.root`，缺省 `''`）：

- GET `${root}/api/cart`
- POST `${root}/api/cart` body `{ product_id, variant_id, quantity: 1, refer_info: { source: 'cart' } }`
- PATCH `${root}/api/cart/${variant_id}` body `{ quantity: 0 }` 删除旧档
- 或 DELETE `${root}/api/cart/${variant_id}`

响应里 cart 在 `data.cart` 或顶层 `cart` / `line_items`；实现 `normalizeCart(json)`：返回 `{ line_items: [] }`。

`eligibleSubtotal` / `pickVariant` 在 widget 内复制精简版（浏览器不 import Node 模块），逻辑必须与 `src/pricing.js` 一致：`final_line_price` 优先、`price <= cap`、`>= raw` 最低档。

DOM：

- 找结账入口：`form[action*="checkout"] button, a[href*="checkout"], button[name="checkout"], [name="checkout"]`，取第一个可见的作为 `checkoutEl`。
- 在其父节点内、该元素**之前**插入 widget；在其**之后**插入 without-protection 链接。
- 找不到结账按钮：不改页面（配置失败同样 no-op）。
- 勾选默认 `true`，sessionStorage 键 `sss.optIn` 记忆本次会话。
- 勾选时把原按钮文案改为 `Checkout with Shipping Secure Service`，取消则恢复 `dataset.sssOriginalText`。
- 拦截原按钮 click（capture）：`preventDefault` + `sync` + 再 `location.href` 原 href 或 `form.submit()` 或 `${root}/checkout`。
- 链接文案精确：`Checkout without protection`。
- 监听 `dj.cartChange` 与 `dj.addToCart` 重新 `render`；handler 内不要在 `dj.cartChange` 里无条件 PATCH（避免循环）。同步函数用 `syncing` 锁。
- 加购失败：widget 内显示一行 `Unable to add protection.`，不阻止 without-protection 链接。

Widget 标记：加购时 `properties: { _sss: '1' }` 便于识别；识别仍以 `product_id` 为准。

同步算法 `ensureProtection(cart, want)`：

1. `items = cart.line_items`
2. `sub = eligibleSubtotal(items, productId)`
3. `picked = pickVariant(...)`
4. `protectLines = items.filter(i => i.product_id === productId)`
5. `want && picked`：若已有唯一行且 `variant_id === picked.variant.id` 且 qty 1 → 完成；否则 DELETE/PATCH 0 所有 protectLines，再 POST 新 variant。
6. `!want || !picked`：删除全部 protectLines。

启动：

```js
(async function () {
  const src = document.currentScript?.src;
  const base = src ? src.replace(/\/widget\.js.*$/, '') : '';
  let cfg;
  try {
    cfg = await fetch(base + '/widget/config').then((r) => {
      if (!r.ok) throw new Error('config');
      return r.json();
    });
  } catch {
    return;
  }
  // mount...
})();
```

样式自包含，前缀 `.sss-`，不引入外部 CSS 框架。区块含标题 `Shipping Secure Service`、checkbox、价格。

- [ ] **Step 1: 实现完整 `public/widget.js`**（单文件，无构建步骤）

- [ ] **Step 2: 本地用静态 HTML fixture 手工点选**（可选）`test/cart-fixture.html` 内伪造 checkout 按钮 + mock `fetch`，用浏览器打开确认 DOM 插入顺序：widget → 按钮 → without-protection。不强制自动化。

- [ ] **Step 3: Commit if requested**

```bash
git add public/widget.js
git commit -m "$(cat <<'EOF'
Inject cart protection widget with dual checkout paths.

EOF
)"
```

---

### Task 5: Script Tag 注册与联调

**Files:**
- Create: `src/scriptTag.js`

**Interfaces:**
- Consumes: `loadConfig()`；OpenAPI `GET/POST /openapi/{ver}/script_tags`
- Produces: 若已存在 `src === {publicBaseUrl}/widget.js` 则跳过；否则 POST `{ script_tag: { src, display_scope: 'cart', event_type: 'app' } }`

- [ ] **Step 1: Implement register**

```js
// src/scriptTag.js
import { loadConfig } from './config.js';

const config = loadConfig();
const src = `${config.publicBaseUrl}/widget.js`;
const api = `https://${config.shopDomain}/openapi/${config.apiVersion}/script_tags`;
const headers = { 'Access-Token': config.token, 'Content-Type': 'application/json' };

const listed = await fetch(api, { headers }).then((r) => r.json());
const tags = listed.data?.script_tags || listed.data || [];
const hit = (Array.isArray(tags) ? tags : []).find((t) => t.src === src);
if (hit) {
  console.log('script tag exists', hit.id);
  process.exit(0);
}

const created = await fetch(api, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    script_tag: { src, display_scope: 'cart', event_type: 'app' },
  }),
}).then((r) => r.json());
console.log(JSON.stringify(created, null, 2));
if (!created.data?.script_tag?.id && created.code && created.code !== 'Success') {
  process.exit(1);
}
```

- [ ] **Step 2: 暴露公网 URL**

本地：`npx cloudflared tunnel --url http://127.0.0.1:8787`（或已有 HTTPS 主机）。把输出的 `https://...` 写入 `.env` 的 `PUBLIC_BASE_URL`（无尾斜杠）。重启 `npm start`。

- [ ] **Step 3: 注册（先 dry 核对 URL）**

Run: `node --env-file=.env src/scriptTag.js`  
Expected: 打印新 tag id 或 `script tag exists`

- [ ] **Step 4: 店铺联调清单（密码预览店）**

1. 打开 `/cart`，DevTools Network 有 `widget.js` 与 `/widget/config`。
2. 车内放非保障商品小计约 $50 → 显示约 **$1.15**。
3. Checkout with protection → 车内 1 件 S0002（或对应档）→ 进入结账。
4. 另开：Checkout without protection → 结账行无保障商品。
5. 小计拉到 ≥2505（或用改价）→ 费用 **$49.48**，不是 $55.03。
6. 取消勾选再点主按钮 → 无保障商品。
7. 断掉 App 服务刷新购物车 → 原生 Checkout 仍可点。

- [ ] **Step 5: Commit if requested**

```bash
git add src/scriptTag.js
git commit -m "$(cat <<'EOF'
Register cart-only script tag for the protection widget.

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| env rate / max covered / fee_cap | 1 |
| 排除保障行小计、向上挂档、cap 选 S0065 | 2 |
| Config API、variants 缓存、无密钥 | 3 |
| 默认勾选、主按钮、without protection、1 件换档 | 4 |
| Script Tag cart only | 5 |
| 配置失败不拦结账 | 4 启动 try/catch |
| 加购失败仍可 without protection | 4 |
| 空车 / 仅保障商品 | 2 + 4 ensureProtection |
| 不改主题 / 不写 checkout 页 | 全局 |

## 本地命令（实现完成后）

```bash
node --test
node --env-file=.env src/server.js
# 另开终端：隧道 + 把 PUBLIC_BASE_URL 写进 .env 后
node --env-file=.env src/scriptTag.js
```
