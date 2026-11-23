# 测试环境开通（店匠 Partner + GOOVAL 测试）

要在 **非生产** 环境联调 Shipping Secure Service，通常需要：**店匠测试店铺 + 私有 App + GOOVAL 测试开号 + 本仓库 Pages 部署**。生产店铺走同一流程，但 `API_DOMAIN` 换为 `https://sp-prod.gooval.io`，且经 GOOVAL 生产开号。

---

## 角色分工

| 谁 | 做什么 |
|----|--------|
| **你（开发 / ISV / 商家技术）** | 注册店匠 Partner、开测试店、建 Private App、部署本 App、注册 Script Tag |
| **GOOVAL 工作人员** | 在 **测试环境** 为你的店铺 **开号**：建保障商品、写 `app-config.js` 费率、Webhook 等（与 [gooval-onboarding.md](./gooval-onboarding.md) 平台侧一致） |
| **本仓库** | 不负责 GOOVAL 开号；开号完成后用 `TOKEN` + `API_DOMAIN`（测试域）拉价档与费率 |

---

## 步骤一：注册店匠 Partner 并开通测试店铺

1. 在店匠开放平台 / Partner 入口 **注册开发者（Partner）账号**（具体入口以 [店匠开放平台](https://www.shoplazza.com/) 当前说明为准）。
2. 登录 Partner 后台，**创建或申请测试店铺（Development / Test Store）**，得到可登录的商家后台与店铺域名，形如 **`xxx.myshoplaza.com`**。
3. 测试店建议：
   - 关闭或知晓 **店铺密码墙** 对买家加车的影响（联调购物车需买家可访问）。
   - 备齐测试商品，便于加购验证 Widget。

此步 **尚未** 涉及 GOOVAL；仅确保你拥有店匠侧 **店主权限**，能创建 Private App。

---

## 步骤二：在测试店创建 Private App

按图文 **[private-app.md](./private-app.md)** 操作：

| 要点 | 说明 |
|------|------|
| **WebHook API version** | **`2026-07`** |
| **Scopes** | 商品/自定义代码/购物车转换等读写，见 private-app 清单 |
| **保存后复制** | `TOKEN`、`APP_UID`、`APP_SECRET`（与 `.env` 前 4 项一致） |

`.env` / Pages 示例（测试）：

```env
TOKEN=...
APP_UID=...
APP_SECRET=...
WEBHOOK_API_VERSION=2026-07
API_DOMAIN=https://sp-test.gooval.io
SHOP_DOMAIN=<你的测试店>.myshoplaza.com
PUBLIC_BASE_URL=https://<你的 Pages 或 ngrok>
PROTECTION_HANDLE=<GOOVAL 开号后约定的 handle>
```

`PROTECTION_HANDLE` 在 GOOVAL 建品前可与对方确认默认值（如 `gwofy-shipping-protection-qaqwer`）。

---

## 步骤三：联系 GOOVAL 工作人员 — 测试店铺开号

Private App 就绪后，通过 **GOOVAL 指定的对接渠道**（邮件 / 工单 / 企业 IM，勿长期明文粘贴 Secret）联系工作人员，说明需要为 **店匠测试店** 开通 Shipping Secure Service **测试环境**。

**建议一并提供：**

| 信息 | 用途 |
|------|------|
| **店铺域名** `SHOP_DOMAIN` | GOOVAL 绑定测试店、`app-config.js?shop=` |
| **`TOKEN`** | GOOVAL 代你方执行 read_shop、建品、Webhook（若约定由 GOOVAL 操作） |
| **`App Secret`** | GOOVAL 侧 Webhook 验签等（按 GOOVAL SOP） |
| **`WEBHOOK_API_VERSION`** | `2026-07` |
| **环境说明** | 明确为 **测试**，对应 `https://sp-test.gooval.io` |
| **联系人 / 邮箱** | 开号结果与 GOOVAL 商家测试账号通知 |

**GOOVAL 测试开号完成后，你方应能验证：**

- 店匠后台存在保障商品（handle 与 `PROTECTION_HANDLE` 一致）。
- `curl -sS "https://sp-test.gooval.io/static/app-config.js?shop=<SHOP_DOMAIN>"` 能解析出 `pricing.calcRate`、`pricing.spMaxCoverage`（见 [gooval-app-config.md](./gooval-app-config.md)）。

未开号前，`/widget/config` 可能因 **无商品 / 无 app-config** 失败，属正常现象。

---

## 步骤四：部署本 App 并联调店面

1. 按 [deploy-cloudflare.md](./deploy-cloudflare.md)（或本地 `npm run dev` + ngrok）部署，`API_DOMAIN` 保持 **`https://sp-test.gooval.io`**。
2. [cloudflare-access.md](./cloudflare-access.md) 配置 `/admin`，在管理页 **注册 Script Tag**。
3. 按 [storefront.md](./storefront.md) 验收：**Cart 页、Cart Drawer、说明 Dialog**。
4. 主题异常见 [theme-compatibility.md](./theme-compatibility.md)。

---

## 测试 vs 生产对照

| 项 | 测试 | 生产 |
|----|------|------|
| GOOVAL API | `https://sp-test.gooval.io` | `https://sp-prod.gooval.io` |
| 店铺 | Partner 测试店或约定测试店 | 正式商家店 |
| 开号 | 联系 GOOVAL **测试开号** | 联系 GOOVAL **生产开号** |
| `PUBLIC_BASE_URL` | `*.pages.dev` / ngrok | 商家正式 Pages 域名 |

切生产时：更新 Pages 环境变量 **`API_DOMAIN`**、确认 **`SHOP_DOMAIN`** 与 **`PROTECTION_HANDLE`**，重新部署，并更新 Script Tag `src`（若域名变更）。

---

## 相关文档

- [创建私有应用](./private-app.md)
- [GOOVAL 接入（完整分工）](./gooval-onboarding.md)
- [环境变量](./environment-variables.md)
- [GOOVAL app-config 仅用 pricing 两字段](./gooval-app-config.md)