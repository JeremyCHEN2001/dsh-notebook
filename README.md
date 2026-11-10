# DSHNotebook 笔记本

把对话里值得留下的内容收进笔记本：Markdown 阅读、直接编辑、粘贴图片、回收站撤销、全文搜索、批量整理，以及可迁移的备份。

> 面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地 Markdown 笔记本插件。数据保存在本机 profile，不依赖任何外部服务。

## 安装

**npm（尚未发布）**

npm 包名已预留为 `dshnotebook`；发布后可在 Harness 的 Plugin Manager 中安装，或让 Agent 安装该 npm 包。当前请先用下面的源码方式安装。安装后需要一次 profile 重新组合（禁用/启用插件或重启应用）。

**从源码**

```bash
git clone https://github.com/JeremyCHEN2001/dsh-notebook.git
```

在 Harness 的 Plugin Manager 中用「安装本地目录」选择该仓库目录；或让 Agent 以该目录为 target 执行 `install_bundle`。Host 与 Client 需要一起加载：安装/更新后重新组合 profile，并刷新一次页面。

**要求**

- DeepSeek Harness（Web / 桌面版，含 Sidebar 与 Conversation 客户端）。
- 无 npm 运行时依赖；`index.js` 只使用 Node 内置模块。
- OCR 为可选能力，需要 macOS 与 Swift 工具链；首次使用时在后台编译 `ocr.swift`，失败时仅 OCR 不可用。

## 功能

**入口与整理**
- 侧边栏「笔记本」图标打开总览；左侧列表支持按更新时间 / 创建时间 / 名称排序，置顶笔记本始终在前。
- 笔记本可新建、重命名、置顶、删除（移入回收站）、合并到另一个笔记本；合并后原笔记本进入回收站。
- 全文搜索覆盖所有笔记正文与笔记本名；结果带匹配片段、命中高亮，点击直接跳到对应笔记。
- 笔记支持标签（逗号分隔），并可按标签、来源工作区、来源会话筛选。

**编辑**
- 笔记可新建、编辑、删除；编辑区**自动保存**（停顿约 0.9 秒），显示「待保存 / 保存中 / 已保存」状态，也可点「完成」立即落盘。
- 取消编辑会恢复到进入编辑前的文本、标签与图片；新建的空笔记取消或完成后不留空记录。
- 阅读模式渲染 Markdown：标题、段落、列表、引用、代码块、分隔线、粗体 / 斜体 / 行内代码 / 链接。编辑模式保留原始 Markdown 文本。

**图片**
- 编辑笔记时可粘贴截图、拖入文件、选择文件，或从 http/https 图片链接导入（内网地址会被拒绝）。
- 超过 1.5 MB 或边长超过 2400px 的图片会在上传前自动缩放并转 WebP（GIF 不压缩）。
- 单张 ≤ 8 MB，每条笔记 ≤ 20 张；服务端按文件头校验，仅接受 PNG / JPEG / WebP / GIF。
- 图片支持说明文字（caption），阅读模式以缩略图展示，点击打开可缩放的灯箱。
- 图片可「识别文字」（macOS Vision OCR，中英文）：识别结果直接追加到当前笔记正文；首次使用前 Host 会在后台编译本地 OCR 助手，之后调用约 1 秒。

**删除与恢复**
- 删除的笔记或笔记本进入回收站，保留 30 天；删除后有「撤销」提示，也可在回收站逐个恢复或彻底删除。
- 回收站最多保留 200 项。

**批量操作**
- 笔记多选后可批量移动、删除或导出所选内容（ZIP / Markdown）。

**备份与迁移**
- 顶部菜单「备份全部数据」导出 JSON 备份（含图片），「备份此笔记本」导出单个笔记本。
- 导入支持：
  - `.json`：本插件导出的完整备份；
  - `.zip`：本插件导出的笔记本 ZIP（含 `notebook.json` 与图片），或其他含 Markdown 的 ZIP（以 Markdown 为一条笔记并附加图片）；
  - `.md` / `.markdown` / `.txt`：作为新笔记本导入。
- 单文件导入上限 32 MB。

**对话入口**
- 在对话中选中一段 AI 回复，**在选中区域内右键**：写入已有笔记本，或新建笔记本（默认名「工作区-会话主题」，可编辑）。
- 每条已完成的 AI 回复的操作行新增「存入笔记本」图标，可直接保存整条回复，无需先选中。
- 写入后顶部提示「已写入《…》」，可「查看」直接跳转；删除笔记/笔记本的提示带「撤销」。

**版本握手**
- API 与客户端都带版本号（当前 v3）。版本不一致时面板显示提示并禁用编辑，避免旧 Host 配新客户端产生半可用状态。

## 使用

1. 在对话中拖动选中一段回复，在选中的文字上右键。
2. 选择目标笔记本写入，或新建并写入。
3. 从侧边栏打开笔记本面板，点笔记右上角铅笔编辑；编辑区可直接粘贴图片。
4. 需要整理时用「选择」进入批量模式；需要迁移时用顶部「更多」里的备份 / 导入。

> 选中文字后直接松开鼠标时，Harness 自带的「引用文本」按钮仍会优先出现；笔记本菜单走右键，两者互不抢占。

## 数据与限制

- 主文件：`$DSH_HOME/plugin-data/dshnotebook/notebooks.json`（默认 `~/.dsh/plugin-data/dshnotebook/notebooks.json`）。
- 图片：同目录下的 `images/<id>.<png|jpg|webp|gif>`，由 Host 路由 `/plugin/dshnotebook/images/...` 提供。
- 写入采用临时文件 + rename；损坏的 `notebooks.json` 会备份为 `notebooks.json.corrupt-<时间戳>`。
- 未被引用的图片在 1 小时后由后台清理；当前进程刚上传的图片不会被清理。
- 上限：500 个笔记本、单本 5000 条笔记、单条 100000 字符、单条 20 张图片、单张 8 MB、回收站 200 项 / 30 天。
- 数据按本机 profile 保存，不按登录账号隔离。

## 实现

- Host：`index.js` 提供 JSON API、图片路由、Markdown/ZIP/JSON 导出路由、导入（含 ZIP 解析）、图片 URL 抓取、macOS Vision OCR（`ocr.swift`）与 `notebook` Agent 工具。
- Client：`client.js` 注册 `sidebar.panellist`、`main`、`conversation.chat.text-interaction`、`conversation.chat.assistant-actions` 与 `shell.overlay`，仅使用 Harness 主题变量与自有样式。
- 显示元数据：`locale/{en,zh}.json` 与 `icon.svg`。
- 导出 ZIP 由 Host 以 store-only ZIP 生成；导入 ZIP 支持 stored 与 deflated 条目。

## 升级

修改或升级 `index.js` / `client.js` 后，已运行的 Harness 需要一次 profile 重新组合（在 Plugin Manager 中关闭再开启该插件行）或重启应用：Host 会在重新组合时重新导入，客户端代码随后刷新页面加载。请先让 Host 更新，再刷新页面，避免两者版本不一致。数据文件与 OCR 缓存不受升级影响。

## 隐私与安全

- 笔记本与图片只写入 `~/.dsh/plugin-data/dshnotebook/`，不会上传到任何服务器。
- Markdown 不注入 HTML，链接与内联图片仅允许 http/https。
- 图片按文件头校验格式（PNG / JPEG / WebP / GIF），拒绝 SVG 等可执行内容；图片路由带 `nosniff`。
- 图片 URL 导入拒绝本机/内网地址并校验重定向，10 秒超时、8 MB 上限。
- ZIP 导入限制条目数、解压总量与压缩方式；导入文件名不用于磁盘路径。
- OCR 通过固定参数的本地 Swift 助手执行，不经过 shell。

## 许可证

[MIT](./LICENSE) © 2026 JeremyChen
