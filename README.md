# IPSW Finder

查詢 iPhone、iPad、Mac 的 IPSW 韌體版本，取得 Apple 下載連結。

**網頁版：<https://hsiao840412.github.io/IPSW-Finder/>**

原生 SwiftUI App 原始碼保留；網頁版放在 `docs/`，以原生 HTML、CSS 與 JavaScript 實作，沒有套件依賴或建置步驟。本機 Xcode 專案的 App 原始碼位於 `IPSW Finder/`。

本工具適用於需要先下載 IPSW 檔案的門市或維修中心，可依裝置與版本過濾連結，複製後貼至下載器一次下載。

## macOS App 安裝

1. 前往 [Releases](https://github.com/hsiao840412/IPSW-Finder/releases) 下載 `IPSW Finder.dmg`。
2. 開啟後將 App 拖入「應用程式」資料夾。

## 網頁版功能

- 顯示 IPSW.me 最新收錄的 iOS、iPadOS、macOS 版本，點選可填入查詢欄位。
- 依裝置類型與完整版本號查詢，合併重複下載連結。
- 下載結果、共用檔案的機型預覽與展開清單，依機型首次發售日期由新到舊排序；全部複製也沿用相同順序。
- 顯示支援機型、檔案大小、Build、發佈日期與簽署狀態。
- 單筆／全部複製連結，直接開啟 Apple 下載來源。
- 支援手機與電腦，包含載入、無結果、網路錯誤、逾時與剪貼簿手動複製狀態。

## 本機預覽

在儲存庫根目錄執行：

```sh
python3 -m http.server 8080 --directory docs --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080/>。請透過 HTTP 伺服器預覽，瀏覽器不支援直接以 `file://` 載入本專案的 JavaScript 模組。API 查詢需要網路連線。

## GitHub Pages

在 GitHub 儲存庫的 **Settings → Pages → Build and deployment** 設定：

1. Source：**Deploy from a branch**。
2. Branch：**main**。
3. Folder：**/docs**。
4. 按 **Save**。

日後將 `docs/` 的變更推送到 `main`，GitHub Pages 會自動更新網站。`docs/.nojekyll` 讓 Pages 直接發佈靜態檔案；資源使用相對路徑，支援 `/IPSW-Finder/` 子目錄。無需 Node.js、額外插件、API 金鑰或伺服器。

## 資料來源與範圍

依據 [IPSW.me 官方 API 文件](https://ipsw.me/api/) 與 [OpenAPI 規格](https://api.ipsw.me/v4/docs/swagger.json)：

- `GET /v4/releases`：從發佈時間表選取各系統最高的完整正式版本號，排除 OTA。
- `GET /v4/devices`：裝置識別碼與顯示名稱。
- `GET /v4/ipsw/{version}`：該版本的韌體、下載網址與簽署狀態。

API 已實測回傳 `Access-Control-Allow-Origin: *`，瀏覽器可直接呼叫。網站只顯示 API 回傳的 Apple 網域下載連結，不儲存或轉送韌體。最新版本表示 IPSW.me 的收錄資料；Mac 查詢範圍是 API 收錄的 Mac IPSW，不提供通用 macOS 安裝程式。簽署狀態依查詢當下資料顯示，共用檔案若狀態不一致則標示「依裝置而異／未確認」。

GitHub Pages 的發佈方式參考 [GitHub 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

機型排序採用 [AppleDB 維護者的裝置資料](https://github.com/littlebyteorg/appledb)，以識別碼對應首次發售日期，資料快照見 `docs/device-releases.mjs`（2026-10-05）。日期資料隨網站一起提供，不增加使用時的外部 API 請求；同日發售以識別碼數字降冪固定順序，同機型的多個韌體 Build 以韌體發佈日期降冪排序。未收錄日期的新機型列於最後並標示「發售日期未確認」，更新快照後即可納入日期排序。AppleDB 採用 MIT 授權，完整授權聲明保留在 `docs/appledb-license.txt`。

## 驗證

Node.js 18 以上可執行無外部依賴的核心邏輯測試：

```sh
node --test tests/firmware.test.mjs
```

測試涵蓋版本排序、正式發佈篩選、裝置分類、下載去重、Apple URL 驗證、共用檔案簽署狀態與 API HTTP／逾時處理。
