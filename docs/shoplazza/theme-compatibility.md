# 主题 / Script Tag 不兼容

Widget 由 **Script Tag** 加载 `widget.js`，在购物车 DOM 里插入区块。**一般不用改店匠主题 Liquid**；不认主题时改 **本仓库少数文件**，部署后 Script Tag 自动拉新版。

---

## 先 30 秒判断

| Network 里 `widget.js` | Elements 里 `sss-widget` | 怎么办 |
|------------------------|---------------------------|--------|
| 非 200 | — | 修 Script Tag / Access，见 [troubleshooting.md](./troubleshooting.md) |
| **200** | **没有** | **主题 DOM 不匹配** → 改下面文件（可用 AI） |
| 200 | 有但样式乱 | 改 `wf-modal.css` 或 `widget.js` 内样式 |
| 200 | 有但结账异常 | 改 `widget.js` 结账相关函数 |

GOOVAL `app-config.js` **不含**店匠挂载配置（仅费率），见 [gooval-app-config.md](./gooval-app-config.md)。

---

## 用 Cursor / Codex 等 AI：只动这几个文件

在 AI 对话里 **@ 引用仓库内路径**（不要改 GOOVAL 后台的 `themeSelectors`、也不要把 `widget.js` 贴进主题后台）。

| 优先级 | 文件 | 何时改 |
|--------|------|--------|
| **1** | **`public/widget.js`** | 几乎所有「不显示 / 插错位置 / 抽屉没有」 |
| **2** | **`public/wf-modal.css`** | 说明弹窗样式被主题盖住、错位 |
| 极少 | 店匠主题 Liquid | 仅当开发同意加固定 `id` / `data-*` 锚点；**不由 AI 改本仓库外文件时由商家主题开发做** |

**不要**让 AI 去改：`src/catalog.js`、`functions/*`、`.env`、GOOVAL 配置——与挂载无关（除非同时是 `/widget/config` 500，另见排障）。

### `public/widget.js` 里常改的符号（告诉 AI 搜这些函数名）

```text
findAllCheckoutEls   — 找结账按钮
SUMMARY_SEL          — 购物车抽屉 / SUMMARY 容器
summaryRoot          — 插入范围
findInsertTarget     — Widget 插在合计行上方
placeWidget / mount  — 挂载
scanAndMount         — 抽屉打开后重扫
looksLikeCheckout    — 过滤假按钮
```

---

## 交给 AI 的素材（复制粘贴）

1. **现象**：例如「抽屉有、/cart 没有」「有按钮无 Widget」。
2. **店铺主题名**（若知道）。
3. **DevTools → Elements**：结账按钮 **Copy outerHTML**（购物车页 + 抽屉各一份）。
4. **Network**：确认 `widget.js`、`/widget/config` 均为 200。
5. **说明**：只改编译部署的 `public/widget.js`，匹配店匠 DOM；改完要 `npm run build` 部署 Pages。

### 可复制提示词（示例）

```text
店匠 Script Tag 已加载 public/widget.js（200），但页面上没有 .sss-widget。
主题结账按钮 HTML 如下：
<paste outerHTML>

请在本仓库 public/widget.js 中调整 findAllCheckoutEls / SUMMARY_SEL /
findInsertTarget，使 Widget 插入到 SUMMARY 区域、结账按钮上方。
只改 public/widget.js，给出最小 diff。不要改 GOOVAL app-config。
```

弹窗问题把「改 `public/wf-modal.css`」写进提示词即可。

---

## AI 改完以后

1. 本地 `npm run dev` 或 ngrok + Script Tag 测购物车页与抽屉。
2. `npm run build` → Cloudflare Pages **重新部署**。
3. Script Tag `src` 不变也会拉到新 `widget.js`（强刷或禁缓存验证）。

商家侧仍只维护 **`/admin` Script Tag**（`src`、`display_scope`），**不必**改主题粘贴脚本。

---

## 商家自查（给 AI 之前）

Chrome 无痕 → F12 → Network 看 `widget.js`；Elements 搜 `sss-widget`。  
`display_scope` 建议含 `cart` 与 `index,collection,product,search`。

---

## 相关文档

- [店面验收](./storefront.md)
- [联调与排障](./troubleshooting.md)
- [GOOVAL app-config 与店匠无关字段](./gooval-app-config.md)