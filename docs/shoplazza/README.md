# 店匠接入文档

本目录存放 **Shipping Secure Service** 与店匠店铺、对接方协作相关的接入说明（与根目录 `README.md` 的部署/运维说明互补）。

**浏览器阅读：** 部署或本地 `npm run dev` 后打开 **`/docs`**（左侧导航，正文内链与同目录图片自动跳转）。

**流程图总览：** [onboarding-flow.md](./onboarding-flow.md)（Mermaid：接入步骤、运行时、文档顺序、Access）

## 文档列表

| 文档 | 说明 |
|------|------|
| [onboarding-flow.md](./onboarding-flow.md) | **流程图**：端到端接入、运行时、`/docs` 阅读顺序、Access |
| [overview.md](./overview.md) | **本项目**：Widget 托管、**Script Tag 管理**、商家 **Fork + 自有 Cloudflare**、`API_DOMAIN` 定价链 |
| [deploy-cloudflare.md](./deploy-cloudflare.md) | **部署教程**：GitHub Fork → Cloudflare Pages → 环境变量 → Script Tag |
| [private-app.md](./private-app.md) | **私有应用创建（含步骤截图）**、Scopes、环境变量 |
| [test-environment.md](./test-environment.md) | **测试开通**：Partner 测试店 → Private App → 联系 GOOVAL 测试开号 → 联调 |
| [gooval-onboarding.md](./gooval-onboarding.md) | **GOOVAL 接入**：店主交凭证 → 开号、读店、建品、`app-config.js`、商家账户与邮件 |
| [storefront.md](./storefront.md) | 店面：购物车/抽屉、结账、弹窗、config 刷新行为 |
| [troubleshooting.md](./troubleshooting.md) | 联调：`/widget/config` 报错、费率不一致、Access、本地代理 |
| [theme-compatibility.md](./theme-compatibility.md) | **主题不兼容**：商家 DevTools 自查 vs 开发改 `widget.js` |
| [environment-variables.md](./environment-variables.md) | **`.env` / Pages 变量**：私有 App 前 4 项、GOOVAL 测试/生产 `API_DOMAIN` 等 |
| [gooval-app-config.md](./gooval-app-config.md) | **`app-config.js`**：仅用 `calcRate` / `spMaxCoverage`；与 Shopify 整包契约的关系 |
| [cloudflare-access.md](./cloudflare-access.md) | **One / Zero Trust Access**：公开路径 vs `/admin` 仅工作人员 |
| [partner.md](./partner.md) | 对接方索引（链至 GOOVAL 主流程） |

## 推荐阅读顺序

1. [overview.md](./overview.md) — 谁做什么  
2. 若要联调：[test-environment.md](./test-environment.md) — Partner 测试店与 GOOVAL 测试开号  
3. [private-app.md](./private-app.md) — 店主建 Private App  
4. [gooval-onboarding.md](./gooval-onboarding.md) — GOOVAL 开号 + 商家部署  
5. [deploy-cloudflare.md](./deploy-cloudflare.md) — Pages 实操  
6. [cloudflare-access.md](./cloudflare-access.md) — **上线前**配置 `/admin` Access  
7. [storefront.md](./storefront.md) / [troubleshooting.md](./troubleshooting.md) — 验车与排障  

## 相关代码

- 店面：`public/widget.js`
- 公开配置：`functions/widget/config.js`、`src/catalog.js`、`src/goovalAppConfig.js`
- Script Tag：`src/scriptTag.js`、`/admin` 管理页