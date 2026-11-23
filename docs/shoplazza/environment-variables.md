# 环境变量说明（`.env` / Cloudflare Pages）

本地复制 `cp .env.example .env`，与 **Cloudflare Pages → Variables and Secrets** 使用 **相同键名**（线上 `TOKEN` 建议用 Secret）。**勿将 `.env` 提交 Git。**

---

## 完整示例

```env
# ── 与店匠私有 App「应用详情」一致 ──
TOKEN=<后台 Access Token>
APP_UID=<应用 UID，本地备份>
APP_SECRET=<应用密钥，本地备份>
WEBHOOK_API_VERSION=2026-07

# ── GOOVAL 与店铺、部署 ──
API_DOMAIN=https://sp-test.gooval.io
SHOP_DOMAIN=gmshash.myshoplaza.com
PUBLIC_BASE_URL=https://gms-hash.pages.dev
PROTECTION_HANDLE=gwofy-shipping-protection-qaqwer
```

---

## 变量一览

### 与私有 App 保持一致（第 1～4 项）

在店匠后台 **应用 → 管理私有 App → 编辑应用** 中复制，详见 [private-app.md](./private-app.md)。

| 变量 | 必填 | 运行时是否读取 | 说明 |
|------|------|----------------|------|
| `TOKEN` | **是** | **是** | 私有 App **Access Token**。Functions 读商品、`/admin` 写 Script Tag 时作 OpenAPI `Access-Token`。**Pages 上请设为 Secret。** |
| `APP_UID` | 建议备份 | **否** | 与应用详情中的 **App UID** 一致，便于对账；本仓库代码不读。 |
| `APP_SECRET` | 建议备份 | **否** | 与应用详情 **App Secret** 一致；Webhook 由 **GOOVAL** 使用，本 App **不**读。**勿泄露、勿提交 Git。** |
| `WEBHOOK_API_VERSION` | **是** | **是** | 与后台 **WebHook API version** 一致，接入固定 **`2026-07`**。用于 OpenAPI 路径版本段。 |

改私有 App 权限或重置 Token 后，须 **同步更新** `.env` 与 Pages 上的 `TOKEN` 并重新部署。

---

### GOOVAL、店匠店铺与部署

| 变量 | 必填 | 说明 |
|------|------|------|
| `API_DOMAIN` | **是**（生产/测试接 GOOVAL） | GOOVAL API **根 URL**（无尾斜杠）。拉取 `app-config.js` 时**仅使用** `pricing.calcRate`、`pricing.spMaxCoverage`（详见 [gooval-app-config.md](./gooval-app-config.md)）。 |
| `SHOP_DOMAIN` | **是** | 店匠提供的店铺域名，形如 `xxx.myshoplaza.com`，**不要**加 `https://`。同时用于 OpenAPI 与 `app-config.js` 的 `shop` 参数。 |
| `PUBLIC_BASE_URL` | **是** | 本 App **对外可访问** 的 HTTPS 根地址（**无尾斜杠**）。Pages 部署后为 `https://<项目>.pages.dev` 或自定义域；本地联调可用 ngrok。**须与 Script Tag 的 `src` 前缀一致。** |
| `PROTECTION_HANDLE` | **是** | 店匠侧 **保障商品 handle**，由 **GOOVAL 建品维护**；本 App 按此 handle 拉 `productId` 与价档 variants。须与 GOOVAL 开号约定一致（示例 `gwofy-shipping-protection-qaqwer`）。 |

#### `API_DOMAIN` 环境对照

| 环境 | 值 |
|------|-----|
| **测试** | `https://sp-test.gooval.io` |
| **生产** | `https://sp-prod.gooval.io` |

测试店配测试域，正式上线改为生产域并 **重新部署**；`SHOP_DOMAIN` 与 GOOVAL 开号店铺一致。

---

### 可选 / 一般不配

| 变量 | 说明 |
|------|------|
| `PROTECTION_RATE`、`PROTECTION_MAX_COVERED` | 仅 **未配置 `API_DOMAIN`** 时的本地兜底费率；接 GOOVAL 后 **不必** 配置。 |
| `FUNCTIONS_PROXY` | 本地 dev 特殊代理用，Pages **不要** 配置。 |
| `PROTECTION_PRODUCT_ID` | 已废弃，按 `PROTECTION_HANDLE` 解析商品 id。 |

---

## 谁提供哪几项

| 变量 | 提供方 |
|------|--------|
| `TOKEN`、`APP_UID`、`APP_SECRET`、`WEBHOOK_API_VERSION` | 店匠店主（私有 App 后台） |
| `SHOP_DOMAIN` | 店匠店主 / 店铺域名 |
| `API_DOMAIN` | GOOVAL（测试 / 生产二选一） |
| `PROTECTION_HANDLE` | GOOVAL（建品约定） |
| `PUBLIC_BASE_URL` | 商家运维（Pages 或 ngrok 实际访问地址） |

---

## 校验

```bash
# 配置是否可加载
node --env-file=.env -e "import { loadConfig } from './src/config.js'; console.log(loadConfig());"

# 公开配置（含 rate，应来自 GOOVAL）
curl -sS "https://<PUBLIC_BASE_URL>/widget/config" | jq '{handle,rate,maxCovered,variants:(.variants|length)}'
```

费率异常见 [troubleshooting.md](./troubleshooting.md)。

---

## 相关文档

- [创建私有应用](./private-app.md)
- [部署 Cloudflare](./deploy-cloudflare.md)
- [GOOVAL 接入](./gooval-onboarding.md)