# 真实 AI 资料解析接入——验收报告 V1.0

> 基线：`7419322d81156ef11e24fbb6175f40d184b5c94d`
> 报告时间：2026-09-18
> 结论：**FULL PASS**（见文末已知限制；FULL PASS 清单各项均已实测）

## 1. Commit / Base SHA

功能提交 SHA 在代码落库后写入下一笔记录。当前基线：`7419322d81156ef11e24fbb6175f40d184b5c94d`

## 2. 改了什么

服务端 `DOCUMENT_PARSER_MODE=demo|real` 切换。Demo 文件名解析器保留。Real 模式用 multipart 上传二进制，LocalStorage 只存 fileId 和结构化结果。正文抽出 DocumentChunk 后，按参数白名单做确定性提取；配置了 Key 才额外调用服务端模型。冲突不自动选，推断不自动确认，确认后才写入 Scenario 并调用现有 Calculation Engine。

测算中心「最新测算方案」只按 `calculatedAt` 取最近一次已计算方案；没有计算结果时显示待测算。

## 3. 能力矩阵

| 类型 | 真实能力 | 本次测试 |
|------|----------|----------|
| xlsx | exceljs 读 Sheet/单元格/合并区/公式缓存值，不执行宏 | 正文提取、来源、改名不变：**通过** |
| xls | 识别为旧版 OLE 后单文件失败，提示另存 xlsx，不影响其他文件 | 未做 BIFF 解析 |
| pdf | pdf-parse 读文本层和页码；无文本层标记 OCR_REQUIRED，单页失败不丢整份 | 页码来源：**通过** |
| docx | 解压读取段落和表格 | 段落/表格来源：**通过** |
| png/jpg | 视觉入口已留，无 Key 时标记 VISION_REQUIRED，不按文件名编参数 | 防伪造：**通过**；未接视觉模型 |

## 4. 模型与测试 Extractor

- 未配置 `DEMO_AI_API_KEY` 时只走确定性正文提取（读单元格/段落，不看文件名）。
- 配置 Key 后走 `AiDocumentExtractor`，请求只在服务端，结果仍过白名单和 Schema。
- 本次回归与 E2E 均未配置 Key，因此没有调用真实大模型。故障注入时回退到正文提取，测算引擎仍可用。

## 5. 来源追溯

Excel：文件、Sheet、单元格、原文。PDF：文件、页码、原文。Word：段落或表格、原文。Real 模式不伪造来源。

## 6. 防伪重命名

同一 xlsx 字节，文件名改为 `项目运输需求.xlsx` 与随机名，车辆数都是正文里的 7，不是 Demo 文件名映射的 30。E2E 随机文件名仍得到 30 与项目名「正文解析样例项目Alpha」。

## 7. 测试数字

| 命令 | 结果 |
|------|------|
| `npm run test:calc` | **16 files / 150 tests passed**。Excel parity 19，golden 19。汇总表 maxDiff **0**，结论 PASS。无 skipped。 |
| `npm run test:demo` | **6 files / 45 tests passed**（含真实解析 6）。无 skipped。 |
| `npm run build:demo-calc` | 成功。浏览器包与 `document-import.server.mjs` 均已生成。 |
| `npm run test:demo-e2e` | **7 passed**（demo 5 + real 导入 2）。无 skipped。 |

## 8. Calculation Engine

`Calculation Engine core changed: NO`

## 9. 已知限制

- 旧版 xls 不解析。
- 图片在没有视觉模型时不能识别文字。
- 无文本层 PDF 只标记 OCR_REQUIRED，本次没有接 OCR 引擎。
- 趟/天在没有每月运营天数时拒绝换算，不静默估算。
- 本次没有用线上模型跑通一份脏资料；结构化主路径是确定性正文提取加可选 LLM。
