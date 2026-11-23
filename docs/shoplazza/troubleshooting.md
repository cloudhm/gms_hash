# 联调与排障

Shipping Secure Service 在店匠 + Cloudflare Pages + GOOVAL 联调时的常见问题。

---

## `/widget/config` 返回 500

| `error` 片段 | 原因 | 处理 |
|--------------|------|------|
| `Code generation from strings disallowed` | 旧版用 `new Function` 解析 `app-config.js`，Workers 禁止 | 使用已修复版本（JSON 提取，见 `src/goovalAppConfig.js`） |
| `CacheTtl: 0, is not compatible with cache: no-store` | 同时设置了 `cf.cacheTtl` 与 `cache: no-store` | 仅保留 `cache: 'no-store'` 与 URL 时间戳参数 |
| `missing API_DOMAIN or both PROTECTION_RATE` | 未配 GOOVAL API 也未配本地费率兜底 | Pages / `.env` 增加 `API_DOMAIN=https://…`（与 GOOVAL 交付一致） |
| `app-config 4xx/5xx` | `API_DOMAIN` 错误或店铺未在 GOOVAL 开通 | 核对 `API_DOMAIN`、`SHOP_DOMAIN` 与 `?shop=` 一致 |
| `GWOFY_CONFIG missing` / `pricing missing` | 脚本格式变化或返回 HTML 错误页 | 浏览器或 `curl` 直接请求 `{API_DOMAIN}/static/app-config.js?shop={SHOP_DOMAIN}` 查看正文 |
| `product list` / `product fetch` | Token、handle 或商品不存在 | 检查 `TOKEN`、`PROTECTION_HANDLE`、GOOVAL 是否已建品 |

---

## curl / 状态页看到的 `rate` 不是 GOOVAL 最新值

1. **对照 GOOVAL 原文**（替换域名与店铺）：

   ```bash
   curl -sS "https://<API_DOMAIN>/static/app-config.js?shop=<SHOP_DOMAIN>" | grep -o '"calcRate":"[^"]*"'
   ```

2. **对照本 App**：

   ```bash
   curl -sS -H 'Cache-Control: no-cache' "https://<PUBLIC_BASE_URL>/widget/config" | jq '{rate,maxCovered,feeCap}'
   ```

3. **仍不一致时检查：**

   - Cloudflare Pages 是否仍配置 **`PROTECTION_RATE`** 且 **未配** 或 **配错** `API_DOMAIN`（未走远程时不会读 GOOVAL）。
   - `API_DOMAIN` 环境是否与 GOOVAL 后台一致（如测试环境 `sp-test.gooval.io`）。
   - 本地 `npm run dev`：`PUBLIC_BASE_URL` 为 ngrok 时由本机 Functions 处理；若配置了 `FUNCTIONS_PROXY` 指向远程 Pages，curl 的是 **线上** 配置。
   - 改的是 `pricing.calcRateByCountries` 而非顶层 **`calcRate`**：当前实现只读 **`calcRate`**。

---

## 无痕访问 `/admin` 被 308 到 `/`

通常 **不是** 本仓库 Vue 路由，而是 **Cloudflare Access** 或 Pages 重定向规则。

- 检查 Access 应用：**登录后回调 URL** 是否错误指到 `/`。
- **`/widget.js`、`/widget/config` 不要加 Access**，否则店面 302/308 到登录，Widget 无法加载。

完整配置与检查清单见 **[cloudflare-access.md](./cloudflare-access.md)**。

---

## 店面没有 Widget

| 检查项 | 说明 |
|--------|------|
| Script Tag | `/admin` 中 `src` 是否为当前 `PUBLIC_BASE_URL/widget.js` |
| `display_scope` | 建议 `index,collection,product,search,cart` |
| 店铺密码墙 | 买家身份无法测车时需先关闭 |
| Network | 是否有 `widget.js`、`/widget/config` **200**（非 Access 302） |
| `/widget/config` body | 含 `variants` 数组且长度 > 0 |

**`widget.js` 已 200 但仍无区块**：多为 **主题 DOM** 与脚本不匹配。商家用 **Chrome DevTools** 自查；开发者改 **`public/widget.js`** 后重新部署。分工与文件清单见 **[theme-compatibility.md](./theme-compatibility.md)**。

---

## `/docs/...` 404 或文档空白

| 现象 | 处理 |
|------|------|
| 浏览器整页 **404**（非 Vue） | Cloudflare 需 `public/_redirects` 中 `/docs/* → /index.html 200`；重新部署 |
| 页面有红条 **HTTP 404** | 运行 `npm run sync-docs`（或重启 `npm run dev`），将 `docs/shoplazza` 同步到 `public/shoplazza-docs` |

---

## 本地开发注意

| 项 | 说明 |
|----|------|
| `npm run dev` | 默认 `http://localhost:8787`；`.env` 由 `vue.config.cjs` 注入 Functions |
| ngrok | `PUBLIC_BASE_URL` 为 ngrok 时 **不** 代理到远程，本机处理 `/widget/config` |
| 非 ngrok 的 `PUBLIC_BASE_URL` | 可能把 `/widget/config` **代理到** 该 URL，本地改 `.env` 不生效 |

---

## 相关代码

| 路径 | 作用 |
|------|------|
| `functions/widget/config.js` | HTTP 入口 |
| `src/catalog.js` | OpenAPI 价档 + 定价解析 |
| `src/goovalAppConfig.js` | 拉取并解析 GOOVAL `app-config.js` |
| `src/config.js` | 环境变量校验 |
| `public/widget.js` | 店面逻辑 |

---

## 相关文档

- [部署到 Cloudflare](./deploy-cloudflare.md)
- [店面行为](./storefront.md)
- [创建私有应用](./private-app.md)