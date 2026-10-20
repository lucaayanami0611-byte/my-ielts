# My IELTS 个人应用说明

本分支在原有 Vue 应用上增加了两种个人安装方式：

- iPhone：PWA，可从 Safari 添加到主屏幕。
- Windows：Tauri 桌面应用，可构建为 NSIS 安装程序。

## 使用源码改动包

先从 GitHub 克隆原项目，再把 `My-IELTS-personal-app-source-overlay.zip` 解压到项目根目录，并允许覆盖同名文件。这个压缩包只包含新增或修改的源码，不重复收录原项目约 480 MB 的音频资源。

## iPhone 安装

PWA 必须通过 HTTPS 地址访问。将代码推送到自己的 GitHub 仓库后，在 Settings → Pages 中将 Source 设置为 GitHub Actions；工作流会在推送 `master` 分支后自动检查、构建并部署网站。

本账号部署地址：https://lucaayanami0611-byte.github.io/my-ielts/

在 iPhone 上用 Safari 打开部署地址，依次选择“分享”→“添加到主屏幕”，并开启“作为网页 App 打开”。应用页面和已经访问过的同源资源会被缓存；音频第一次播放时会完整缓存，之后可以离线再次播放。iOS 仍可能在设备空间不足时清理网站缓存。

## Windows 构建

首次构建需要安装 Node.js、pnpm、Rust、Microsoft C++ Build Tools 和 WebView2。依赖准备好后运行：

```powershell
pnpm install
pnpm tauri build
```

安装程序默认生成在：

```text
src-tauri/target/release/bundle/nsis/
```

桌面版将全部词汇和音频资源打包在本地，安装后无需网络即可使用本地内容。YouTube 视频、在线词典和有道在线发音仍然需要联网。

## 开发与验证

```powershell
pnpm dev
pnpm typecheck
pnpm test -- --run
pnpm build
pnpm tauri dev
```

修改前端代码后，重新执行 `pnpm tauri build` 即可生成新的安装程序。
