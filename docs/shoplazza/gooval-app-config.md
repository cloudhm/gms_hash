# GOOVAL `app-config.js` 与本项目

费率接口由 GOOVAL 按环境提供：

```http
GET {API_DOMAIN}/static/app-config.js?shop={SHOP_DOMAIN}
```

| 环境变量 `API_DOMAIN` | 用途 |
|------------------------|------|
| `https://sp-test.gooval.io` | 测试 |
| `https://sp-prod.gooval.io` | 生产 |

返回体为一段 JavaScript：`g.GWOFY_CONFIG = { … }`（IIFE）。本仓库在服务端解析该对象，**只读取定价字段**，再写入 `GET /widget/config` 的 JSON。

---

## 本项目实际使用的字段

实现见 `src/goovalAppConfig.js` → `pricingFromGwofyConfig()`。

| 路径 | 用途 | 映射到 `/widget/config` |
|------|------|-------------------------|
| `pricing.calcRate` | 保障费率（小数或数字字符串） | `rate` |
| `pricing.spMaxCoverage` | 可保金额上限（**分**，如 `250500`） | `maxCovered`（**元**，÷100，如 `2505`） |

除上述两项外，**本店匠私有 App 不消费** `GWOFY_CONFIG` 其它键。

店匠侧 **价档列表** 仍来自 **店匠 OpenAPI**（按 `PROTECTION_HANDLE` 拉 variants），与 `app-config.js` 里的商品配置无关。

---

## 响应里为何还有大量其它字段

`app-config.js` 的 JSON 结构与 GOOVAL **Shopify 店面插件** 共用同一套配置契约：同一接口按 `shop` 返回整包 `GWOFY_CONFIG`，其中包含例如：

- `themeSelectors`（主题 DOM 锚点）
- `widgetAssets`、`tipsDialog`、`text`、`copy`
- `calcRateByCountries`、`currencySymbols`、`supportedLocales`
- `auth`、`productHandle`（Shopify 侧）等

**Shopify 插件脚本** 会在浏览器里读取并应用这些字段（挂载位置、文案、多国家费率等）。

**本项目（店匠 + `public/widget.js`）** 是独立实现：

- 服务端只从该接口取 **`pricing.calcRate`**、**`pricing.spMaxCoverage`**
- 购物车挂载、弹窗样式、结账逻辑在 **`public/widget.js`** / **`wf-modal.css`** 中维护，**不读取** `themeSelectors` 等配置

因此在 GOOVAL 后台改 **主题选择器**、**Widget 文案资源** 等，**不会**自动改变店匠店面表现；若 `calcRateByCountries` 与顶层 **`calcRate`** 不一致，本 App **仅认顶层 `calcRate`**（见 [troubleshooting.md](./troubleshooting.md)）。

对接方排查费率时，只需核对上述两个 pricing 字段与 `curl /widget/config` 中的 `rate`、`maxCovered`；无需根据响应里的 Shopify 字段推断店匠 Widget 行为。

---

## 调用链（简图）

```text
GET /widget/config
  ├─ OpenAPI → variants（店匠商品）
  └─ GET sp-{env}.gooval.io/static/app-config.js?shop=…
         └─ 仅提取 pricing.calcRate、pricing.spMaxCoverage
```

---

## 相关文档

- [环境变量 `API_DOMAIN`](./environment-variables.md)
- [主题兼容性](./theme-compatibility.md)（DOM 不由 app-config 驱动）
- [GOOVAL 接入](./gooval-onboarding.md)
