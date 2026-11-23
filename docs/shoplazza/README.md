# 店匠接入文档

本目录存放 **Shipping Secure Service** 与店匠店铺、对接方协作相关的接入说明（与根目录 `README.md` 的部署/运维说明互补）。

## 目录规划

| 文档 | 说明 |
|------|------|
| [overview.md](./overview.md) | 架构与数据流（Script Tag、`widget.js`、`/widget/config`） |
| [private-app.md](./private-app.md) | 私有应用、Scopes、环境变量 |
| [storefront.md](./storefront.md) | 店面行为：购物车/抽屉、结账、弹窗 |
| [partner.md](./partner.md) | 对接方：保障商品 handle、variants、Webhook |
| [troubleshooting.md](./troubleshooting.md) | 联调与常见错误 |

未完成的条目可先写草稿，文件名保持稳定便于链接。

## 相关代码

- 店面：`public/widget.js`
- 公开配置：`functions/widget/config.js`、`src/catalog.js`
- Script Tag：`src/scriptTag.js`、`/admin` 管理页