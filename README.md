# dsh-token-dashboard

DeepSeek Harness（DSH）的全局 Token 用量看板。它是一个真正的 Cordis 插件：Host 端只读聚合本机所有会话日志，Web 端在 DSH 原生界面中注册一个 **Token Dashboard** 入口和独立面板，不修改 DSH 源码、`node_modules`，也不是一个外挂的独立 Web 应用。

> 已在本机 DSH Desktop `0.2.1-rc.3`（Cordis `4.0.5`，profile `desktop`）中安装、加载并用真实历史会话验证。

---

## 目录

- [项目介绍](#项目介绍)
- [功能](#功能)
- [安装](#安装)
- [使用](#使用)
- [开发与构建](#开发与构建)
- [Token 统计口径](#token-统计口径)
- [数据架构与存储](#数据架构与存储)
- [HTTP API](#http-api)
- [测试与真实验证](#测试与真实验证)
- [已知限制](#已知限制)
- [发布到 GitHub](#发布到-github)
- [许可证](#许可证)

---

## 项目介绍

DSH 已经能在单个会话里显示 Token 用量，但缺少一个跨项目、跨会话、包含子代理会话的全局视图。`dsh-token-dashboard` 补充的正是这一层：

- **Host 端**通过官方 `ctx.sessionPersistence` 读取本机保存的全部会话，用 `ctx.sessions` 读取活跃会话，并以 `session/event` 增量更新；
- **Client 端**通过官方 Slot 机制在侧边栏底部（个人信息上方）注册入口、在 `main` 区域注册统计面板，使用 DSH 主题 Token 渲染，跟随深色/浅色主题；
- 数据只在同源 HTTP 路由上以 JSON 提供，复用 Host 的 Connection 鉴权；插件不写会话日志、不改模型请求、不上传任何数据。

统计口径直接对齐 `@deepseek-ai/dsh-token-meter` 的 `tokenUsage` 投影：四个互斥的 provider 账单桶相加，流式样本被最终样本替换，重试开启新的计费 attempt，分叉继承的历史不重复计入。

## 功能

### 全局统计

- 总 Token、未缓存输入、输出、缓存读、缓存写
- 模型请求次数、缓存命中率、会话总数（含活跃、子代理、分叉会话）
- 全部历史会话、当前活跃会话、子代理会话统一纳入

### 时间范围

- Usage 区支持今天（按小时）、最近 7 / 30 / 90 天、全部时间、自定义日期区间
- 范围只作用于 Usage 图表；KPI、模型、会话与费用均为生命周期总量
- 范围切换只在前端对已聚合的时间桶做筛选，不触发日志重读

### 图表

- 一个 Usage 图表，通过 Tokens / Input / Output / Cache 三个视图切换
- Tokens：输入 / 缓存读 / 缓存写 / 输出四类堆叠
- Input / Output：两类分组对比
- Cache：缓存读 / 写堆叠 + 每桶命中率折线
- 纯 SVG、无图表依赖；悬停提示显示该桶明细

### 模型分布

- 模型名称完全来自会话事件里的 `provider` / `model` 与 `request/header`
- 总 Token、输入、输出、缓存、请求次数、占比
- 无法可靠识别模型的事件归入 **Unknown**，绝不猜测

### 会话明细

- 可搜索（标题 / 项目 / 模型 / 会话 ID）、可按项目与模型筛选
- 点击“最近活动”或“总量”表头排序；分页展示
- 每行展示标题、项目、模型、最近活动与 Token 总量
- 点击行打开右侧详情抽屉：四类 Token、请求数、命中率、创建/最近活动时间与逐模型明细
- 宿主提供 `uiWorkspace.openSession` 时可一键跳转到该会话

### 实时与性能

- Host 监听官方 `session/event`，新请求完成即增量折叠，不重扫历史
- 使用持久化 `revision` 判断日志是否变化；未变化会话直接复用内存聚合
- 首次打开才扫描历史；之后打开看板不再全量扫描
- 客户端轮询带 `ETag` / `If-None-Match`，数据未变化时只返回 `304`
- 历史读取并发上限 3，不阻塞主界面

### 费用估算（可选）

- 按模型分别配置输入 / 输出 / 缓存读 / 缓存写单价（每 1M tokens）与币种
- 单价只保存在当前浏览器 `localStorage`，插件不联网、不推断价格
- 费用区默认折叠在页面底部；展开后按模型显示估算金额，未配置价格的模型显示 **Not set**

### 导出

- 全局汇总 CSV（指标 + 模型汇总）
- 会话明细 CSV（仅统计字段）
- 统计 JSON
- 导出会去掉工作目录（cwd）；不包含聊天内容、工具参数、密钥

### 界面

- 侧边栏左下角入口（Settings/个人信息上方）+ `main` 独立面板，不改动既有页面
- 单一内容面板：四列 KPI + Usage + Models + Sessions + 折叠费用行，减少卡片与说明文字
- 使用 `--dsw-alias-*` 主题 Token，自动适配深色 / 浅色
- 响应式布局：4/2/1 列 KPI、表格窄屏隐藏次要列、详情在窄屏占满宽度
- 完整的加载中、空数据、错误、部分会话读取失败状态

## 安装

### 前置条件

- 能运行 DSH Web UI 的 DeepSeek Harness（本项目验证于 `0.2.1-rc.3`）
- 从源码构建时需要 Node.js ≥ 22.18 与 pnpm

### 1. 构建

```bash
git clone https://github.com/shi-YangYang/dsh-token-dashboard.git
cd dsh-token-dashboard
pnpm install
pnpm build
```

构建产物：

- `lib/`：Host 入口与聚合模块（Node ESM）
- `client/client.js`：浏览器 bundle（React 由 DSH 模块表提供，不重复打包）

> 仓库不提交构建产物。直接克隆后必须先 `pnpm install && pnpm build`，否则安装时会找不到 `./client` 入口。

### 2. 安装到当前 DSH profile

使用 DSH 的插件管理机制安装**本地目录 bundle**：

- 图形界面：在 DSH 的 Plugins / 插件管理页面选择从本地目录安装 bundle，目标选择本仓库的绝对路径；
- 或让 DSH 内的 Agent 调用：

```text
plugin_manager(action: "install_bundle", target: "/绝对路径/dsh-token-dashboard")
```

安装会由 DSH 写入当前 profile 的依赖与 bundle 选择，不需要手工修改 profile 的 `package.json` 或 `cordis.patch.yml`。

### 3. 启用与刷新

- 安装后 bundle 默认启用，可在插件管理器中单独禁用。
- 首次安装通常通过 HMR 立即生效。
- 如果更新了已安装包的 Host/Client 代码，**刷新一次 Web 页面**以加载新的 Client bundle；需要全新 Host 模块代际时重启 DSH 最稳妥。

### 4. 打开

在左侧边栏的**左下角**、Settings / 个人信息上方点击 **Token Dashboard** 入口。

> 入口注册在 `sidebar.footer.action`（`order: -1`），位于 Settings / 个人信息区上方，与内置 Cordis 状态行同处 footer 区；侧边栏收起为 56px rail 时显示为窄图标。

## 使用

### 顶部

- 左侧是页面标题，右侧只有刷新与导出
- 刷新图标在请求期间旋转；没有额外的说明文字或更新时间行

### KPI

- 四个数值：Total / Input / Output / Cache tokens
- 每个数值只有一行补充信息：请求数、占比或缓存命中率
- 鼠标悬停数值可查看精确整数

### Usage 图表

- 标题右侧切换时间范围；Custom 时展开起止日期
- 图表上方左侧切换视图（Tokens / Input / Output / Cache），右侧显示该范围的总量与请求数
- `Today` 按小时展示今天 24 个小时桶；其余范围按自然日、空缺补零
- 图表悬停可查看该桶四类 Token 与请求数

### 会话表

- 搜索框匹配标题、项目、模型与完整会话 ID
- 项目与模型下拉筛选
- 点击 **Last active** 或 **Total** 表头切换排序（再次点击反向）
- 每行展示标题、项目、模型、最近活动与总量；项目也以次要文字显示在标题下方
- 点击或键盘 `Enter` / `Space` 打开右侧详情抽屉
- 活跃、子代理、分叉、读取失败（Stale）标签保持低调

### 费用估算

1. 页面底部一行 **Estimated cost**；未设置价格时点击 **Set prices**
2. 为每个模型填写币种与四个单价（每 1M tokens）
3. 保存后立即计算；留空的数值按 0 处理，整行留空则不配置
4. 已设置价格时点击该行展开逐模型估算；**Manage prices** 重新编辑
5. **Clear all** 清除全部本地单价

费用只是估算，不是 provider 账单；插件不会自动抓取价格。

### 导出

右上角 **Export**：

- **Summary CSV**：生命周期指标 + 模型汇总
- **Sessions CSV**：所有会话的生命周期统计
- **Statistics JSON**：与看板相同的统计数据（cwd 置空）

文件名包含 `data.today` 日期，便于归档。

### 刷新

- 默认每 4 秒轮询一次；页面隐藏时停止
- **Refresh** 强制 Host 重新核对所有会话 revision（只读变化的日志）

## 开发与构建

```bash
pnpm install        # 安装开发依赖
pnpm build          # Host (tsc) + Client (esbuild)
pnpm typecheck      # Host / Client / Test 三套类型检查
pnpm test           # 编译测试并运行 node:test
pnpm verify:real    # 读取本机真实会话日志做独立校验
pnpm prepack        # 发布前构建（npm pack / publish 前自动执行）
```

### 目录结构

```text
src/
  host/
    index.ts        # Cordis Host 入口：apply / inject / 生命周期
    fold.ts         # 纯 Token 折叠（与 token-meter 口径一致）
    aggregate.ts    # revision 缓存、增量聚合、payload 构建
    source.ts       # sessionPersistence / sessions / sessionQuery 适配
    server.ts       # 只读同源 HTTP 路由、ETag、鉴权
    verify.ts       # 与官方 tokenUsage 投影的诊断对比
    types.ts        # 对 DSH 服务的结构化类型
  shared/           # Host/Client 共用的纯函数与 wire 类型
  client/
    index.ts        # 浏览器 bundle 入口
    plugin.ts       # Slot 注册（main + sidebar.footer.action）
    App.tsx         # 页面编排：数据、布局、弹窗开关
    DashboardHeader.tsx
    usePricing.ts   # 浏览器本地单价状态
    hooks.ts        # 轮询、宽度、locale、modal
    components/
      Cards.tsx     # KPI
      Trends.tsx    # 范围 + 图表视图
      Models.tsx    # 模型表
      Sessions.tsx  # 会话表
      SessionDetail.tsx
      Cost.tsx
      PricingEditor.tsx
      ExportMenu.tsx
      charts.tsx    # 原生 SVG 图表
      common.tsx    # Button / Select / Modal / Menu / ...
      ui/           # 通用 UI 原语
        Section.tsx
        Tabs.tsx
        DataTable.tsx
        Drawer.tsx
        Stat.tsx
    locales.ts      # 中英文字典
    styles.ts       # 主题 Token CSS
test/               # 68 个单元 / 路由 / 渲染 / bundle 注册 / jsdom 集成测试
scripts/
  build-client.mjs  # esbuild + __ModuleLoader__ 包装
  test.mjs          # tsc + node --test
  verify-real-sessions.mjs
```

### 技术选择

- Host 用 TypeScript 编译为 Node ESM，不引入运行时依赖；
- Client 用 esbuild 打成单个 CommonJS bundle，再包装为 DSH 的 `window.__ModuleLoader__.load({ id, factory(require) })`；
- `react` 标记为 external，由宿主模块表注入，避免重复 React；
- 图表用原生 SVG + React，不引入 ECharts/Chart.js；
- 无数据库、无外部服务、无网络请求（除同源 `/dsh-token-dashboard/*`）。

### 前端组件化与框架选择

**这个插件本来就用 React，不需要再“尝试 React”。** DSH 的 Client Slot 渲染器接收的是 React 元素，`react` 由宿主的浏览器模块表提供（bundle 中标记为 external），所以插件不重复打包 React，也不会出现两个 React 实例。

**为什么不用 Vue：** DSH 的扩展点是 React Slot（owner props、标准 hooks、主题、locale 都由 React 侧提供）。要在 Slot 里使用 Vue，只能在 React 组件内挂一个 DOM 容器、再启动一个 Vue 应用，这会：

- 在 bundle 里再打入一份 Vue runtime；
- 失去 React Slot 的上下文、生命周期和更新机制；
- 增加主题、locale、事件桥接的复杂度，并显著增大体积。

因此当前版本继续使用 React，并把页面拆成两层组件：

- **功能组件**：`DashboardHeader`、`KpiCards`、`Trends`、`ModelTable`、`SessionTable`、`SessionDetail`、`CostPanel`、`PricingEditor`、`ExportMenu`，各自只关心一个功能区。
- **通用原语**：`ui/Section`（带标题/操作区的区块）、`ui/Tabs`（时间范围/图表视图）、`ui/DataTable`（泛型表格，模型/会话/费用三处复用）、`ui/Drawer`（详情抽屉）、`ui/Stat`（详情数字块）。
- **状态 hooks**：`useStats`（ETag 轮询）、`usePricing`（localStorage 单价）、`useLocaleSnapshot`、`useNow`、`useModal`、`useElementWidth`。
- `App.tsx` 只负责编排数据与组件，不再包含表格或弹窗的 DOM 结构。

`DataTable<T>` 通过列定义复用表头、单元格、行点击/键盘激活和数字对齐；会话表的可排序表头也只是传入 `header` 与 `aria-sort` 的列，而不是再写一套 `<table>`。

## Token 统计口径

### 权威来源

- 唯一事实来源是 DSH 会话日志（`SessionPersistence`）。
- 每个请求的用量来自 `assistant/message` / `assistant/attempt` 事件：
  - `assistant/message.data.usage` 优先；
  - 否则读取该事件 `stream` 中最后一个 `chunk.type === 'usage'` 的样本。
- 不采用字符数启发式估算，不自行调用模型 tokenizer。

### 四个互斥桶

| 字段 | 含义 |
|---|---|
| `uncachedInputTokens` | provider 的 `inputTokens`（未命中缓存的输入） |
| `cacheReadTokens` | provider 的 `cacheReadTokens` |
| `cacheWriteTokens` | provider 的 `cacheWriteTokens` |
| `outputTokens` | provider 的 `outputTokens`（含其上报的 reasoning 输出） |

**总 Token = 以上四项之和。** 缓存读/写不会与未缓存输入重复相加。

### 替换、重试与请求计数

- 同一 `(turn, step)` 的最终样本**替换**先前的流式样本，不会重复累计。
- `llm/retry-started` 关闭该 `(turn, step)` 的替换作用域；后续 attempt 重新计一次。
- 请求数 = 实际产生用量的计费 attempt 数；替换不是新请求。
- 失败且没有上报用量的请求不产生 Token，也不计入请求数。
- 预估值/上下文占用（`contextPressure`）**不**计入账本。

### 分叉与继承

- 子会话日志可能包含从父会话继承的事件前缀。
- Host 通过官方 `SessionHandle.inheritedEventCount` / `Session.inheritedEventCount` 取得权威切点：
  - **自身总量**只统计切点之后的事件，避免父会话用量被重复计算；
  - 完整日志总量仅保留在诊断字段 `allTotals` 中，用于和官方 `tokenUsage` 投影比对。
- 父会话与所有分叉会话相加，不会重复计算同一次真实请求。

### 时间与模型

- 时间桶使用 Host 的本地时区：日 `YYYY-MM-DD`、时 `YYYY-MM-DDTHH`。
- “今天”只保留最近 48 小时的时桶，避免载荷无限增长。
- 模型身份取自：
  - `assistant/message.message.source`（`kind: 'model'` 的 `provider` / `model`）；
  - `assistant/attempt` 使用最近一次 `request/header.header.config`；
  - 两者都没有时归入 `Unknown`（key 为 `unknown`）。
- 不会硬编码模型名称，也不会把未知模型映射到猜测值。

### 缓存命中率

```text
cacheHitRate = cacheReadTokens
             / (uncachedInputTokens + cacheReadTokens + cacheWriteTokens)
```

即“输入侧”命中率；没有任何输入 Token 时为 0。该定义在 UI 的统计口径说明中明确标注。

## 数据架构与存储

### 只读

- 插件只调用：
  - `ctx.sessionPersistence.list()`
  - `ctx.sessionPersistence.open(id, 'read')` → `read()` → `close()`
  - `ctx.sessions.list()/get()` 与 `snapshotEvents()`（活跃会话）
  - `ctx.sessionQuery.observeSession(..., { projectionMode: 'all' })`（仅诊断接口）
- 从不 `append` / `flush` / 写回 / 删除会话日志，也不修改模型请求。

### 缓存

- Host 内存缓存以会话 id 为键，保存派生聚合与已折叠事件数；
- 持久化会话的缓存键是 `revision`；活跃会话使用 `session.seq` 判断增量；
- 同一进程内第二次打开看板不会重读未变化日志；
- 进程重启后缓存自动丢弃，首次打开重新从日志重建——**缓存是纯派生数据，可随时删除**；
- 插件不创建第二份磁盘 Token 账本，也没有 SQLite 索引。

### 传输

- 单一只读路由前缀：`/dsh-token-dashboard`
- 复用 Host `connection.requestRejection` 的鉴权（未登录/非受信访问返回 401/403）
- 响应 `Cache-Control: no-store`，统计响应带弱 ETag
- 数据只在本机同源页面与 Host 之间传输

### 载荷中的信息

仅包含统计与元数据：

- 四类 Token、请求数、时间桶、模型分布
- 会话标题（来自 `session/title`，DSH 本身的列表也会展示）、项目名、cwd（仅页面内显示，导出时清空）、时间、父会话 id、Agent 预设
- 会话读取失败只返回会话 id 与固定 reason code

**不包含**：用户消息、助手文本、工具参数/结果、文件内容、附件、凭据、API Key。

## HTTP API

所有接口为 `GET`（`HEAD` 亦支持）：

| 路径 | 说明 |
|---|---|
| `/dsh-token-dashboard/stats` | 完整看板 payload；`?refresh=1` 强制核对 revision |
| `/dsh-token-dashboard/verify` | 与官方 `tokenUsage` 投影逐会话比对；`?limit=40`（上限 200） |
| `/dsh-token-dashboard/health` | `{ ok, apiVersion, initialized, revision }` |

- `/stats` 在数据未变化且 `If-None-Match` 命中时返回 `304`。
- `/verify` 只返回 id 与四类桶数字，不返回标题、路径或内容；用于验证折叠是否与官方投影一致。`matchedBasis` 会区分官方投影匹配的是“自身总量”还是“完整日志总量”。

## 测试与真实验证

### 自动化测试

```bash
pnpm typecheck
pnpm test
```

当前 68 个测试全部通过，覆盖：

- 四桶求和、流式替换、retry 重开、重复 seq、零用量请求、Unknown 归因
- 分叉继承前缀不进入自身/全局总量
- 日/时桶、替换跨日移动、48 小时时桶保留策略
- revision 缓存：首次全读、未变化复用、只重读变化会话、活跃增量、活跃→持久化、读取失败保留旧值、删除会话
- 真实源适配器：persisted/live 合并、只读 handle、tail 读取、投影 lease 释放
- HTTP：ETag/304、`refresh=1`、Host 鉴权短路、404/405、verify 匹配与不匹配
- 范围筛选、模型合并、费用、CSV 注入防护、JSON 脱敏
- 组件 SSR 渲染 + jsdom 中完整挂载、fetch、渲染、手动刷新
- 编译后的 Client bundle 实际加载、factory 返回、footer 入口与 main 面板渲染

### 真实历史会话校验

```bash
pnpm build
pnpm verify:real
```

该脚本直接读取本机 `$DSH_HOME/sessions`（或 `~/.dsh/sessions`）中最高的会话日志代际，使用**编译后的生产 fold** 折叠，并用脚本内一份独立实现逐会话比对总量、请求数与模型行。

在本机实测（数量会随当前会话继续增长）：

```text
23 个会话 / 16k+ 事件 / 2,000+ 用量样本
mismatchedSessions: 0
modelMismatches: 0
totalsMatch: true
aggregator:
  readsOnFirstPass: 23
  readsOnSecondPass: 0
  reusedOnSecondPass: 23
  revisionStable: true
  实际模型路由: deepseek-v4.1-flash@opencode-go, deepseek-flash@deepseek-account
```

### DSH 内安装验证

- `plugin_manager install_bundle`：`application: applied`
- 移除 bundle：路由变为 404；重新安装：`application: applied`
- 客户端 Slot 注册（编译后 bundle 测试通过）：
  - `sidebar.footer.action` 注册 `dsh-token-dashboard`（order -1，位于 Settings 区上方）
  - `main` 注册 key `dsh-token-dashboard`
  - 旧版本的 `sidebar.panellist` 入口已移除，避免顶部和底部出现两个入口
- 页面刷新后可在 live Slot 检查中确认 footer 入口；刷新前当前进程里的页面仍持有旧 bundle。
- `/dsh-token-dashboard/health` 在未登录的 loopback `curl` 下返回 **401**，说明路由已挂载且 Host Connection 鉴权生效（浏览器内登录后才会返回数据）。

### 尚未完成的验证

- **视觉效果未通过截图验证**：当前会话没有浏览器自动化能力，无法确认实际像素、深色/浅色切换与窄屏表现。已用 SSR + jsdom 验证挂载与数据渲染，并在 CSS 中只使用主题 Token；请在 DSH 页面中打开面板确认外观。
- 通过 DSH 登录态实际拉取 `/stats` 的 JSON 未能在 shell 中完成（curl 被 401 拒绝），因此“真实 DSH 服务 → HTTP → 页面”的完整链路以单元/路由测试和 Slot 注册为证据，而非浏览器端到端抓包。

## 已知限制

1. **内存缓存不跨进程持久化**：重启 DSH 后第一次打开会重新扫描所有会话日志；在本机 23 个会话、约 16k 事件规模下为毫秒级。没有磁盘索引/SQLite，避免引入不可重建的账本。
2. **首次打开成本与历史总量成正比**：采用并发 3 的批处理，但超大历史（数十万事件）仍可能需要数秒；这是只读扫描，不阻塞 DSH 主界面。
3. **范围只作用于 Usage 图表**：KPI、模型、会话和费用始终是生命周期总量；这样避免同一页面混用两套范围口径。
4. **费用估算完全手动**：不内置价格表、不联网、不做币种换算；单价只存在当前浏览器。
5. **会话跳转依赖 `uiWorkspace.openSession`**：宿主不提供该服务时按钮隐藏或不生效。
6. **单价存在浏览器本地**：卸载插件或更换浏览器不会自动清理/迁移 `localStorage` 中的单价；需要时可在浏览器站点数据中删除。
7. **分叉口径差异**：本插件全局统计排除继承历史；官方 `tokenUsage` 投影在某些版本可能包含完整日志。`/verify` 会同时报告自身与完整日志两种结果，便于核对。
8. **标题与项目元数据**：没有 `session/title` 的旧会话显示“未命名会话”；项目名优先取工作区标题，否则取 cwd 目录名（Windows / POSIX 分隔符都支持）。
9. **仅覆盖当前 profile 的持久化根**：其他 profile、其他机器或未落盘的会话不在统计内。
10. **成本/运行环境**：验证版本为 DSH `0.2.1-rc.3`；插件通过结构化类型访问公开服务，未导入 DSH 内部实现，但仍可能因 DSH 大版本变化需要适配。
11. **动画/图表细节**：图表为自绘 SVG，不提供缩放、刷选、导出图片等高级交互。
12. **未做本地化日期格式的全语言覆盖**：使用 `Intl` 跟随宿主 locale（中/英），其他语言回退到 `Intl` 默认。

## 发布到 GitHub

仓库已初始化为独立项目，默认分支 `main`：

```bash
git add .
git commit -m "feat: token dashboard plugin"
git push origin main
```

当前 `origin` 已指向 `git@github.com:shi-YangYang/dsh-token-dashboard.git`。发布前建议：

1. 确认 `pnpm typecheck && pnpm test && pnpm build && pnpm verify:real` 全部通过；
2. 更新 `package.json` 版本与 README 的验证版本；
3. 打 tag 并创建 GitHub Release：

```bash
git tag v0.1.0
git push origin v0.1.0
```

4. 可选发布到 npm：

```bash
pnpm prepack     # 生成 lib/ 与 client/
npm pack         # 检查 tarball 内容
npm publish      # 需要 npm 登录；包名可能已被占用
```

如果 `dsh-token-dashboard` 在 npm 已被占用，可改为 scope 包，例如 `@your-name/dsh-token-dashboard`。改名后必须同步：

- `package.json` 的 `name`
- `cordis.patch.yml` 的 `name`
- 重新 `pnpm build`（Client bundle 的模块 id 取 `package.json.name`）

建议 GitHub topics：`deepseek-harness`、`dsh-plugin`、`cordis`、`token-usage`、`dashboard`。

## 许可证

[MIT](./LICENSE) © 2026 小洋

---

### 致谢

- DSH 的 `sessionPersistence`、`sessionProjections`、`tokenMeter` 与 Slot/Theme 机制
- `@deepseek-ai/dsh-token-meter` 公开的 `tokenUsage` 语义（本项目在 Host 侧复现同一折叠规则，并提供 `/verify` 与官方投影交叉验证）
