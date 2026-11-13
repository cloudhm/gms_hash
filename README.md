# Shipping Secure Service

店匠私有 App：在购物车（含抽屉）展示运费保障区块，按小计约 2% 向上挂到虚拟商品变体，主按钮带保障结账。

管理端是 Vue + Element Plus，接口走 Cloudflare Pages Functions。店面注入的是 `public/widget.js`，不经过 Vue。

---

## 1. 在商家后台创建 Private App

用要接入的那家店登录店匠商家后台（例如 `https://gmshash.myshoplaza.com/admin`）。

1. 打开 **应用**（或 **设置 → 开发者 / OpenAPI**）。
2. 选择 **私有应用 / Private App → 创建**。
3. 填写名称（例如 `Shipping Secure Service`）。
4. 勾选 **Scopes / 权限**（见下一节）。缺权限时 OpenAPI 返回 **403**。
5. 保存后记下：
   - **Access Token** → `TOKEN`
   - **App UID** → `APP_UID`（仅本地备份，代码不读）
   - **App Secret** → `APP_SECRET`（仅本地备份，代码不读）
6. 店铺主域名记为 `SHOP_DOMAIN`（形如 `xxx.myshoplaza.com`，不要带 `https://`）。

API 版本用 **2026-07**（环境变量 `WEBHOOK_API_VERSION`）。

保障商品请先同步或上架到本店，**handle 保持**：

`gwofy-shipping-protection-qaqwer`

项目按 handle 解析商品 UUID，**不必**再配 `PROTECTION_PRODUCT_ID`。商品需可售（库存/可购买），否则加车会 406。

### Scopes（权限）

创建私有应用时勾选下面这些。后台中文名可能是「商品 / 自定义代码 / 事件订阅」，以 **scope 字面量** 为准。

**必选（Widget + `/admin` 注册脚本）**

| Scope | 后台常见名称 | 本项目用途 | 调用 |
|---|---|---|---|
| `read_product` | 商品 · 查看 | 按 handle 解析保障商品，拉 variants 价档 | `GET /openapi/2026-07/products?handles=`、`GET /products/{id}` |
| `read_script_tags` | 自定义代码 / 脚本标签 · 查看 | `/admin` 列出已注册的 Script Tag | `GET /openapi/2026-07/script_tags` |
| `write_script_tags` | 自定义代码 / 脚本标签 · 编辑 | 注册、改 src、删除 `widget.js` 注入 | `POST` / `PUT` / `DELETE .../script_tags` |

没有 `write_script_tags` 时，拉价档可能仍正常，但 `/admin` 注册脚本会 **403**（之前缺「自定义代码」就是这个）。

**可选（只用 `/admin` 管 Webhook 时再开）**

| Scope | 说明 |
|---|---|
| 后台 **Webhook / 事件订阅 / 通知** 读写 | `GET/POST/PUT/DELETE /openapi/2026-07/webhooks`。CLI 的 `supported_scopes` 里没有单独的 `read_webhook` 字面量，以商家后台这一项为准。 |

**不要勾（本项目用不到）**

`write_product`、`read_order` / `write_order`、`read_customer`、主题、财务等。Widget 加车走的是**店面** `/api/cart`，不消耗订单/顾客 OpenAPI。

最小集合（复制）：

```
read_product,read_script_tags,write_script_tags
```

改过 scopes 后要 **重新生成 / 保存 Token**，旧 `TOKEN` 不会带上新权限。

---

## 2. 本地配置

```bash
cp .env.example .env
```

`.env` 必填：

```
TOKEN=<后台复制的 Access Token>
WEBHOOK_API_VERSION=2026-07
PROTECTION_RATE=0.02
PROTECTION_MAX_COVERED=2505
SHOP_DOMAIN=<店铺 myshoplaza 域名>
PUBLIC_BASE_URL=http://localhost:8787
PROTECTION_HANDLE=gwofy-shipping-protection-qaqwer
```

用 ngrok 给店铺注入脚本时，把 `PUBLIC_BASE_URL` 改成 ngrok HTTPS 地址（无尾斜杠），并保证 `npm run dev` 的 `allowedHosts` 已开（当前 `vue.config.cjs` 为 `all`）。

不要把 `.env` 提交进 Git。

```bash
npm install
npm run dev
```

开发服务：`http://localhost:8787/`

- `/` 状态页（health、handle、价档数量）
- `/admin` Script Tag / Webhook 管理（本地无口令；**线上必须**走 Zero Trust `/one/access-controls/apps`）
- `/widget.js` 店面脚本
- `/widget/config` 公开配置（不含 TOKEN）

本地不单独起 Wrangler；接口由 Vue CLI 中间件走 `functions/` 同一套逻辑。

---

## 3. 注册店面脚本

1. 浏览器打开 `/admin`。
2. **注册 Script Tag**：`src` 填 `{PUBLIC_BASE_URL}/widget.js`，`display_scope` 建议  
   `index,collection,product,search,cart`（购物车页 + 抽屉都能挂上）。
3. 换域名或从 ngrok 切到 Pages 后，在表格里 **更新 src**，不要重复堆多条。

店铺要先关掉密码墙才能用买家身份测加车。

---

## 4. 部署到 Cloudflare Pages

构建：**`npm run build`**  
输出目录：**`dist`**  
Functions：仓库根目录 `functions/`（不要删）。

**Settings → Variables and Secrets**

| 类型 | 变量 | 说明 |
|------|------|------|
| Secret | `TOKEN` | 私有应用 Access Token |
| Variable | `SHOP_DOMAIN` | `xxx.myshoplaza.com` |
| Variable | `PROTECTION_HANDLE` | `gwofy-shipping-protection-qaqwer` |
| Variable | `PROTECTION_RATE` | `0.02` |
| Variable | `PROTECTION_MAX_COVERED` | `2505` |
| Variable | `WEBHOOK_API_VERSION` | `2026-07` |
| Variable | `PUBLIC_BASE_URL` | 线上地址，如 `https://xxx.pages.dev`（无尾斜杠） |

不要配：`PROTECTION_PRODUCT_ID`、`FUNCTIONS_PROXY`。`APP_UID` / `APP_SECRET` 本项目 Functions 不读。

改 Secrets 后重新部署一次。部署完成后把 Script Tag 的 `src` 改成 `https://你的域名/widget.js`。

### 线上必须加 Cloudflare Access（否则谁都能看、都能改）

本项目 **`/admin` 没有应用口令**。Pages 一旦公开，任何人都能打开管理页、注册/删除 Script Tag 和 Webhook，Functions 会用你的 `TOKEN` 改店铺。

**上线后必须**在 Zero Trust 里加 Access Application，再开站点：

1. 打开 Cloudflare **Zero Trust** 控制台：路径 **`/one/access-controls/apps`**  
   （完整地址形如 `https://one.dash.cloudflare.com/<账号ID>/access-controls/apps`）
2. **Add an application → Self-hosted**
3. Application domain 选你的 Pages 域名（`xxx.pages.dev` 或自定义域）
4. **只保护管理端**，不要把整站锁死（否则店铺 Script Tag / 买家会打不开 `widget.js`）：

| 路径 | Access | 原因 |
|---|---|---|
| `/admin` | **必须保护** | 管理 UI |
| `/admin/api*` | **必须保护** | 改 Script Tag / Webhook 的接口 |
| `/` | 建议保护 | 状态页会露出 productId、handle、价档数量 |
| `/widget.js` | **不要保护** | 店面 Script Tag 要公开拉脚本 |
| `/widget/config` | **不要保护** | widget 算费要用 |
| `/webhooks` | **不要保护** | 店匠服务器 POST 回调，过不了登录页 |

5. Policy：只允许你的邮箱 / 团队（Google、One-time PIN 等）。未登录访问 `/admin` 应跳到 Cloudflare 登录，而不是直接进页。
6. 加完 Access 再把 Script Tag 指到线上 `widget.js`。没加 Access 等于把店铺 Token 能力暴露在公网。

本地 `npm run dev` 不走 Access，仅本机调试。

---

## 5. 工作原理（简）

1. Functions 用 `TOKEN` 按 `PROTECTION_HANDLE` 查商品，拉 variants。
2. `GET /widget/config` 下发 `productId`、费率、价档（无密钥）。
3. `widget.js` 等购物车行渲染后插入区块；结账时加一档保障变体再跳转。
4. 保障费 = 非保障小计 × `PROTECTION_RATE`，向上取最近变体价，且不超过 `2505 × 费率`。

---

## 常用命令

```bash
npm test
npm run dev
npm run build
```
