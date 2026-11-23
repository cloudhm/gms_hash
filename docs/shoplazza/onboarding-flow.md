# 接入总览流程图

根据当前 `docs/shoplazza` 文档整理的端到端流程。**测试**与**生产**步骤相同，仅 `API_DOMAIN`（`sp-test` / `sp-prod`）与 GOOVAL 开号环境不同。

---

## 1. 端到端接入（谁 → 做什么）

```mermaid
flowchart TB
  subgraph shoplazza [店匠侧]
    P[注册 Partner / 开店]
    PA[创建 Private App<br/>Scopes + TOKEN]
    P --> PA
  end

  subgraph gooval [GOOVAL]
    G[工作人员测试/生产开号]
    G1[read_shop]
    G2[建保障商品 handle]
    G3[Webhook + app-config 费率]
    G --> G1 --> G2 --> G3
  end

  subgraph merchant [商家运维 / ISV]
    F[Fork 本仓库]
    E[配置 .env / Pages 变量<br/>TOKEN · SHOP_DOMAIN · API_DOMAIN · PUBLIC_BASE_URL · PROTECTION_HANDLE]
    D[Cloudflare Pages 部署]
    A[Zero Trust：仅 /admin*]
    S[Access 后进 /admin 注册 Script Tag]
    F --> E --> D --> A --> S
  end

  subgraph verify [验收]
    V1[首页 / 公开]
    V2[Cart · Drawer · Dialog]
    V3{widget.js 200 且无 .sss-widget?}
    V4[改 public/widget.js · AI/开发]
    V1 --> V2 --> V3
    V3 -->|是| V4 --> V2
    V3 -->|否| OK[完成]
  end

  PA -->|提交 Token · 店铺域名| G
  G3 -.->|calcRate · spMaxCoverage| D
  PA --> E
  S --> V1
```

---

## 2. 运行时：买家购物车加载链

```mermaid
flowchart LR
  SLZ[店匠店面]
  ST[Script Tag]
  WJS[GET /widget.js]
  CFG[GET /widget/config]
  OAI[店匠 OpenAPI<br/>variants]
  APP[GOOVAL app-config.js<br/>仅 pricing 两项]
  W[public/widget.js<br/>挂载 · 弹窗 · 结账]

  SLZ --> ST --> WJS --> W
  W --> CFG
  CFG --> OAI
  CFG --> APP
  CFG -->|rate · maxCovered · variants| W
```

---

## 3. 文档阅读顺序（对应流程节点）

```mermaid
flowchart TD
  O[overview 谁做什么] --> T{需要测试店?}
  T -->|是| TE[test-environment]
  T -->|否| PI[private-app]
  TE --> PI
  PI --> GO[gooval-onboarding 交凭证开号]
  GO --> DC[deploy-cloudflare]
  DC --> CA[cloudflare-access]
  CA --> SF[storefront 验收]
  SF --> TR{异常?}
  TR -->|config/Access| TS[troubleshooting]
  TR -->|主题 DOM| TC[theme-compatibility]
  TR -->|费率字段| GA[gooval-app-config]
  TR -->|变量| EV[environment-variables]
```

---

## 4. Access 与公开路径（部署后）

```mermaid
flowchart LR
  subgraph public [无需登录]
    ROOT["/ 状态页"]
    WJ["/widget.js"]
    WC["/widget/config"]
    DOCS["/docs/*"]
  end
  subgraph protected [Zero Trust]
    AD["/admin"]
    API["/admin/api/*"]
  end
  Buyer[买家 / 文档读者] --> WJ
  Buyer --> WC
  Staff[工作人员] --> AD --> API
```

---

## 相关文档

- [接入索引](./README.md)
- [测试环境](./test-environment.md)
- [GOOVAL 接入](./gooval-onboarding.md)