# prices.json GitHub Pages 自动发布说明

本文档说明如何通过 GitHub Actions 自动生成并发布 [`prices.json`](../prices.json) 到 GitHub Pages 站点根目录，以支持浏览器直接预览。

## 1. Pages 预览 URL

固定预览 URL：

```text
https://lazzman.github.io/one-hub/prices.json
```

说明：部署成功后，`prices.json` 位于 Pages artifact 根目录，因此可通过站点根路径直接访问。

## 2. 仓库设置要求（必须）

在仓库 Settings 中完成以下最小配置：

1. 进入 **Settings → Pages**
2. 将 **Source** 设置为 **GitHub Actions**

若未启用上述配置，`deploy-pages` 作业会失败或无法对外提供页面。

## 3. Workflow 行为

工作流文件：`.github/workflows/prices-release.yml`

- 触发方式：
  - 每日定时（UTC `0 1 * * *`，北京时间 09:00）
  - 手动触发（`workflow_dispatch`）
- 并发控制：`concurrency.group = prices-pages-publish`，避免并发部署冲突。
- 最小权限：
  - `contents: read`
  - `pages: write`
  - `id-token: write`
- 发布链路：
  1. 运行 `scripts/pricing/fetch-and-build-prices.py` 生成 `prices.json`
  2. 使用 `actions/upload-pages-artifact` 上传站点 artifact（根目录包含 `prices.json`）
  3. 使用 `actions/deploy-pages` 部署到 GitHub Pages

## 4. 本地脚本

- 抓取并生成：`scripts/pricing/fetch-and-build-prices.py`
- 供应商映射：`scripts/pricing/vendor-channel-map.json`
- 生成过滤规则：仅保留能映射到有效正整数 `channel_type` 的模型；映射值为 `0`（或其他无效值）及未命中映射的模型将被丢弃。

可选本地生成示例：

```bash
python scripts/pricing/fetch-and-build-prices.py --output prices.json
```
