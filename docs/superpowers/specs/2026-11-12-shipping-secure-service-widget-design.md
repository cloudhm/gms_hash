# Shipping Secure Service 购物车 Widget — 设计说明

日期：2026-11-12  
店铺：gooval.myshoplaza.com  
形态：店匠私有 App + 购物车 Script Tag

## 目标

在购物车页原有 Checkout 区域上方插入 **Shipping Secure Service** 保障区块（类似 Route）：

- 按当前购物车商品小计计算保障费（费率暂定 2%）。
- 费用向上挂到店铺已有虚拟商品的多 variants 价档。
- 可保金额上限 **2505**（与费率相乘得到费用上限）。
- 主路径：带保障结账。
- 区块下方提供 **Checkout without protection**。

第一期只做购物车页。店匠 Script Tag 不能注入 checkout / thank_you；结账页扩展不在本期范围。

## 非目标

- 不改主题 Liquid（避免换主题失效）。
- 不在结账页加购或改价。
- 不处理理赔后台、保单履约、Webhook 理赔流。
- 不把私有 App `TOKEN` / `APP_SECRET` 下发到浏览器。

## 绑定商品（已存在，不新建）

| 字段 | 值 |
|------|-----|
| 标题 | Shipping Secure Service |
| Handle | `gwofy-shipping-protection-qaqwer` |
| Product ID | `7c811a80-72f8-4972-9305-f32ecf8d35db` |
| 变体数 | 98（SKU `S0001` … `S0098`） |
| 最低档 | `S0001` $0.98 |
| 最高档 | `S0098` $359.00 |

价档前段约每档 +$0.30，后面档距加大。Widget **只按价格选档**，不依赖 SKU 序号公式。

在 2% 且 cap = 2505 × 2% 时，实际会用到的最高档是 **`S0065` $49.48**（下一档 $55.03 超过费用上限）。更高价 SKU 保留在商品上，改费率或提高 2505 后可自动用到。

## 计费

费率与可保上限 **只从环境变量读取**，不写死在代码里。服务启动时加载，经 Config API 下发给 widget（公开配置，不含密钥）。改 `.env` 后重启即可生效。

| 环境变量 | 含义 | 当前值 |
|----------|------|--------|
| `PROTECTION_RATE` | 费率（小数，如 `0.02` = 2%） | `0.02` |
| `PROTECTION_MAX_COVERED` | 可保小计上限 | `2505` |

派生量：

- `rate` = `PROTECTION_RATE`
- `max_covered` = `PROTECTION_MAX_COVERED`
- `fee_cap` = `max_covered × rate`（当前 **50.10**）
- `protection_product_id` = 上表 ID

算法：

1. 读取购物车 line items。
2. `subtotal` = 所有 **非保障商品** 行的应付小计之和（数量 × 行价，不含运费、税费；不含保障商品，避免套娃）。
3. 若 `subtotal <= 0`：不展示加购、不往车里放保障 SKU。
4. `covered = min(subtotal, max_covered)`
5. `raw = covered × rate`
6. `cap = max_covered × rate`
7. 在 98 个变体中：
   - 候选 = `price <= cap` 的变体
   - 选 **`price >= raw` 且 `price <= cap` 的最低价变体**
   - 若没有 `price >= raw` 的候选，选候选中 **价格最高** 的一档
8. 购物车中该商品始终 **数量 1、仅一个变体**。小计变化则换档（先去掉旧档再加新档，或等价的 change）。

举例：

| 非保障小计 | raw | 选中 |
|------------|-----|------|
| $50 | $1.00 | `S0002` $1.15 |
| $100 | $2.00 | `S0005` $2.05 |
| $2505 或更高 | $50.10 | `S0065` $49.48 |

## 购物车交互

默认 **勾选保障**（Route 同款）。

区块挂在 **原 Checkout 按钮上方**：

- 标题：Shipping Secure Service（可微调文案，不改计费）。
- 展示本单保障费（选中变体价）。
- 勾选框控制是否加购。

**主按钮（勾选时）**

- 文案体现带保障结账（例如 Checkout with Shipping Secure Service）。
- 点击：确保车里是当前应选变体、数量 1 → 再跳转原来的结账 URL。

**主按钮（未勾选时）**

- 恢复店铺原 Checkout 文案与行为。
- 点击前移除保障商品（若有）。

**按钮下方链接**

- 文案：Checkout without protection
- 行为：移除保障商品 → 走原结账（即使勾选框仍开着，该链接也强制不带保障）。

购物车数量/折扣变化时重新计算并刷新展示金额；若已勾选，同步换档。

保障商品本身不在店面目录主路径推销；若买家从商品页误加，Widget 仍按「该 product_id 全部行都是保障行」处理：计费排除它们，同步时收敛为 1 件正确档。

## 架构

```
浏览器购物车页
  Script Tag (display_scope=cart)
    → 拉公开配置（product_id / rate / max_covered / 价档表）
    → 读店铺购物车 AJAX
    → 渲染区块、拦截 Checkout
    → 加/改/删保障 variant 后跳转结账

私有 App 服务
  GET /widget.js          前端脚本（静态或带短缓存）
  GET /widget/config.js   公开配置 + 价档（无密钥）
  启动时或管理命令：用 Access-Token 调 OpenAPI 注册 script_tag
  可选：后台刷新价档缓存（商品变体变更时）
```

密钥只留在服务端 / `.env`（`TOKEN`、`APP_UID`、`APP_SECRET`）。注册 Script Tag 使用 OpenAPI `POST /openapi/2026-07/script_tags`，`display_scope=cart`，`src` 指向可公网访问的 `widget.js`。

价档表：服务端用私有 App token 拉 product variants，缓存后下发给 widget。前端不写死 98 档，避免改价后挂错档。

## 组件边界

| 单元 | 职责 | 依赖 |
|------|------|------|
| 计费模块 | subtotal / covered / raw / 选档 | 价档列表、rate、max_covered |
| 购物车适配 | 读车、加购、删行、换档 | 店匠 storefront cart API |
| Widget UI | 区块、勾选、双出口结账 | 计费结果、适配器 |
| Script Tag 安装 | 把 JS 挂到 cart | OpenAPI + 公网 src |
| Config API | 公开配置 | 商品 ID、variants 缓存 |

## 错误处理

- 拉配置失败：不拦截 Checkout，保持原生按钮，避免卡死结账。
- 加购失败：提示无法添加保障，提供「不带保障结账」；不强制阻塞。
- 购物车仅保障商品、没有其他货：不卖保障，清掉保障行。
- 价档为空或全部高于 cap：不展示加购（当前商品最低 $0.98，cap $50.10，不会发生；仍要防御）。

## 测试要点

- 小计 $0 / 空车 / 只有保障商品。
- $50 → $1.15；刚好卡在某档价格上（`raw` 等于某变体价则选该档，不上跳）。
- 小计 ≥ 2505 → $49.48，不多加、不换到 $55.03。
- 勾选切换、without-protection 链接、刷新后车内仍最多 1 件保障。
- 改数量后换档（例如从 S0002 换成 S0005）。
- Script Tag 未加载或接口 500 时原生 Checkout 仍可用。

## 配置摘要

`.env`（密钥与可调参数；`PROTECTION_RATE` / `PROTECTION_MAX_COVERED` 必填）：

```
PROTECTION_RATE=0.02
PROTECTION_MAX_COVERED=2505
PROTECTION_PRODUCT_ID=7c811a80-72f8-4972-9305-f32ecf8d35db
PROTECTION_HANDLE=gwofy-shipping-protection-qaqwer
```

`fee_cap` 不单独配环境变量，运行时用 `PROTECTION_MAX_COVERED * PROTECTION_RATE` 计算。缺省或无法解析为数字时服务拒绝启动，避免静默用错费率。
