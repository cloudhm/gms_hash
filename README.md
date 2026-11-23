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

**对接方负责：** 按店铺注入/更新该 handle 的保障商品（图、variants），以及在店匠侧注册 Webhook。本仓库不提供商品写入接口，也没有 Webhook 接收或管理页。

### Scopes（权限）

创建私有应用时在 **接口调用权限** 中按下表选择（中文后台名称可能略有差异，以 **scope 字面量** 为准）。

| 后台名称 | 应选择 | Scope | 用途 |
|---|---|---|---|
| 商品权限 | **读取和写入** | `read_product`、`write_product` | Functions 读保障价档；对接方维护保障商品 |
| 订单权限 | **读取** | `read_order` | 对接侧读订单；本仓库 Widget **不**写订单 |
| 自定义代码权限 | **读取和写入** | `read_script_tags`、`write_script_tags` | `/admin` 管理 Script Tag |
| 店铺信息权限 | **读取** | `read_shop` | 读店铺信息 |
| 购物车转换 | **读取和写入** | `read_cart_transform`、`write_cart_transform` | 购物车转换相关 OpenAPI |

`write_product`、`write_script_tags` 缺任一时，对接建品或 `/admin` 注册脚本会 **403**。

**不要勾（本期未用）**

`write_order`、客户、主题、财务、专辑等未在上述表中的权限。Widget 加车走店面 `/api/cart`。Webhook 由对接方在店匠侧自行注册。

最小集合（复制）：

```
read_product,write_product,read_order,read_script_tags,write_script_tags,read_shop,read_cart_transform,write_cart_transform
```

步骤截图与后台勾选说明见 [docs/shoplazza/private-app.md](./docs/shoplazza/private-app.md)。

改过 scopes 后要 **重新生成 / 保存 Token**，旧 `TOKEN` 不会带上新权限。

---

## 2. 本地配置

```bash
cp .env.example .env
```

`.env` 结构与 [docs/shoplazza/environment-variables.md](./docs/shoplazza/environment-variables.md) 一致：

- **第 1～4 项**与店匠 **私有 App 应用详情** 一致：`TOKEN`、`APP_UID`、`APP_SECRET`、`WEBHOOK_API_VERSION=2026-07`
- **`API_DOMAIN`**：测试 `https://sp-test.gooval.io`，生产 `https://sp-prod.gooval.io`
- **`SHOP_DOMAIN`**：店匠店铺域名（无 `https://`）
- **`PUBLIC_BASE_URL`**：部署后可访问地址（本地可用 `http://localhost:8787` 或 ngrok HTTPS）
- **`PROTECTION_HANDLE`**：GOOVAL 维护的保障商品 handle

复制：`cp .env.example .env` 后按上表填写。

用 ngrok 给店铺注入脚本时，把 `PUBLIC_BASE_URL` 改成 ngrok HTTPS 地址（无尾斜杠），并保证 `npm run dev` 的 `allowedHosts` 已开（当前 `vue.config.cjs` 为 `all`）。

不要把 `.env` 提交进 Git。

```bash
npm install
npm run dev
```

开发服务：`http://localhost:8787/`

- `/docs` **店匠接入文档**（`docs/shoplazza` 同步渲染，含截图）
- `/` 状态页（health、handle、价档数量）
- `/admin` 仅 Script Tag 管理（本地无口令；**线上必须**走 Zero Trust `/one/access-controls/apps`）
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

**从 GitHub Fork 到自有 Cloudflare 的图文步骤：** [docs/shoplazza/deploy-cloudflare.md](./docs/shoplazza/deploy-cloudflare.md)（上游示例仓库 `github.com/cloudhm/gms_hash`）。

构建：**`npm run build`**  
输出目录：**`dist`**  
Functions：仓库根目录 `functions/`（不要删）。

**Settings → Variables and Secrets**

| 类型 | 变量 | 说明 |
|------|------|------|
| Secret | `TOKEN` | 私有应用 Access Token |
| Variable | `SHOP_DOMAIN` | `xxx.myshoplaza.com` |
| Variable | `PROTECTION_HANDLE` | `gwofy-shipping-protection-qaqwer` |
| Variable | `API_DOMAIN` | 测试 `https://sp-test.gooval.io` / 生产 `https://sp-prod.gooval.io` |
| Variable | `WEBHOOK_API_VERSION` | `2026-07` |
| Variable | `PUBLIC_BASE_URL` | 线上地址，如 `https://xxx.pages.dev`（无尾斜杠） |

不要配：`PROTECTION_PRODUCT_ID`、`FUNCTIONS_PROXY`。`APP_UID` / `APP_SECRET` 本项目 Functions 不读。

改 Secrets 后重新部署一次。部署完成后把 Script Tag 的 `src` 改成 `https://你的域名/widget.js`。

### 线上必须加 Cloudflare One 访问控制（Zero Trust Access）

部署后 **同一域名** 上既有 **公开** 的 `widget.js` / `/widget/config`，也有仅工作人员可用的 **`/admin`**（管理 Script Tag，背后用你的 `TOKEN`）。`/admin` **没有应用内口令**，须用 **One 面板** 配置 Access，否则公网任何人都可改 Script Tag。

**图文步骤、Policy、误配排查与检查清单：** [docs/shoplazza/cloudflare-access.md](./docs/shoplazza/cloudflare-access.md)

控制台路径：`/one/access-controls/apps`。要点：**Self-hosted + 按 Path 保护 `/admin*`，勿锁整域**；`widget.js` 与 `/widget/config` **不要** 加入 Access。

本地 `npm run dev` 不走 Access。

---

## 5. 工作原理（简）

1. Functions 用 `TOKEN` 按 `PROTECTION_HANDLE` 查商品，拉 variants。
2. `GET /widget/config` 下发 `productId`、费率、价档（无密钥）。
3. `widget.js` 等购物车行渲染后插入区块；结账时加一档保障变体再跳转。
4. 保障费 = 非保障小计 × `rate`（来自 GOOVAL `calcRate` 或 `PROTECTION_RATE`），向上取最近变体价，且不超过 `maxCovered × rate`。

---

## 常用命令

```bash
npm test
npm run dev
npm run build
```
