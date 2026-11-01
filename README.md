# voice-zh-tw

[English](README.en.md)

將 Claude Code `/voice` 聽寫產生的簡體中文轉成台灣繁體，並套用台灣用語。

| 聽寫原文 | 換成 |
| --- | --- |
| 我现在讲的是繁体中文 | 我現在講的是繁體中文 |
| 帮我检查软件的内存设置 | 幫我檢查軟體的記憶體設定 |

自己打字、貼上和歷史紀錄叫回的文字會保留原文。判定為聽寫的新增片段含有簡體專用字時才會轉換整個片段，因此純繁體的「軟件」保留原文，混合片段「软件和軟件」則會轉成「軟體和軟體」。

![voice-zh-tw 轉換示範](demo/voice-zh-tw.gif)

示範用腳本模擬 `/voice` 的聽寫輸入，走的是 mod 實際的轉換程式，沒有錄音，也不代表語音辨識的準確度。[觀看 MP4](demo/voice-zh-tw.mp4)，重錄方式見 [demo/README.md](demo/README.md)。

## 安裝

### 前置條件

- 已安裝並登入 Claude Code CLI，且帳號與執行環境可使用 `/voice`。先在 Claude Code 輸入 `/voice` 確認功能可用，並允許終端機存取麥克風。
- Claude Code 版本須支援 `hooks.json` 的 `modules` 與 `prompt.*` 事件。本指南已在 **Claude Code 2.1.308** 測試；最低相容版本尚未確認。
- 安裝時需要連線到 GitHub。轉換程式與字典已內附，不需 `npm install`、Bun 或額外 API key。Claude Code 的登入與 `/voice` 使用條件仍由 Claude Code 提供。

沒有麥克風或尚未設定 Claude Code，可以先跑下方的[離線試跑](#離線試跑不需麥克風)。

### 安裝外掛

在 Claude Code 的輸入框輸入以下指令。

```
/plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

出現 `Add marketplace?` 時按 `y`，範圍選 user（直接按 Enter）。

也可以從 shell 安裝。

```sh
claude plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

成功時會顯示 `Successfully installed plugin: voice-zh-tw@voice-zh-tw`。從 shell 安裝後，開啟新的 Claude Code session，讓外掛載入；之後新開的 session 會自動載入。可在 shell 執行以下指令，確認清單內有 `voice-zh-tw@voice-zh-tw` 且已啟用。

```sh
claude plugin list
```

本指南的驗證範圍是 Claude Code CLI。桌面版的安裝介面與 hook 載入尚待實機驗證。

## 第一次使用

1. 在新開的 Claude Code session 輸入 `/voice`，啟用聽寫。
2. 讓輸入框保持空白，按住空白鍵，等畫面顯示 `listening…` 後說「幫我檢查軟體的記憶體設定」。
3. 放開空白鍵，等聽寫結果寫入輸入框。若辨識服務原本回傳簡體，應顯示為「幫我檢查軟體的記憶體設定」。按住模式可先查看文字，再決定是否送出。

語音辨識可能聽錯字，這個外掛負責字形與用語轉換。要單獨確認轉換程式，使用下方的離線試跑。

## 離線試跑（不需麥克風）

需要 Git 與支援直接執行 TypeScript 的 Node.js **22.18 以上版本**。已測 Node.js 24.21.0。以下流程不需 Claude Code、帳號或 API key，也不會送出對話。

```sh
git clone https://github.com/cucuwang/voice-zh-tw.git
cd voice-zh-tw
node --version
node demo/simulate.mjs --quick
```

已經有 checkout 時，從 repo 根目錄執行最後兩行即可。無須安裝依賴。成功時會看到四組範例，最後一行為 `示範完成 · 4 組結果已核對 · 模擬輸入，無錄音`。例如打字接聽寫會保留「这段是我打的：」，並將新增聽寫轉為「幫我檢查軟體的記憶體設定」。

這會執行實際 hooks 與 OpenCC，並用本機 adapter 模擬輸入事件。真實麥克風、語音辨識及 Claude Code 載入外掛仍需依「第一次使用」驗證。更多選項見 `node demo/simulate.mjs --help`；測試方式見[開發與檢查](docs/development.md)。

## 遇到問題

| 現象 | 下一步 |
| --- | --- |
| `claude: command not found` | 先依 [Claude Code 安裝文件](https://code.claude.com/docs/en/setup)安裝 CLI，重新開啟終端機後執行 `claude --version`。 |
| 安裝時出現 `unknown option '--marketplace'`，或不支援 `modules` | 執行 `claude --version` 並更新至支援上述功能的 Claude Code 版本。本指南已測版本為 2.1.308。 |
| 已安裝卻仍是簡體 | 用 `claude plugin list` 確認外掛已啟用，再開新的 session。以 `/voice` 聽寫測試；貼上簡體會保留原文。 |
| 沒有 `/voice` 或沒有錄到聲音 | 先確認 Claude Code 的登入、功能可用性與作業系統麥克風權限，再試原生聽寫。外掛處理的是聽寫完成後的文字。 |
| Node.js 無法載入 `.ts`、出現 TypeScript 語法錯誤 | 用 `node --version` 確認版本至少為 22.18，並確認沒有停用 Node.js 的 TypeScript 執行功能。 |
| `Cannot find module 'claude-code/testing'` | hook 測試須執行 `claude plugin test .`，完整指令見[開發與檢查](docs/development.md)。 |

## 使用建議

- 按住空白鍵的模式有一小段暖機時間，畫面出現 `listening…` 才開始錄，太早開口會漏掉開頭一兩個字。改用 `/voice tap`（點一下開始、再點一下送出）可以避開；點一下模式可能直接送出訊息。
- 按 Esc 取消聽寫時，輸入框會還原成原本的內容。若清空後還原的文字與記住的草稿相同，外掛會保留原文。

## 運作方式

- 按住模式的聽寫會觸發來源為 `engine` 的 `prompt.change`。外掛以已知文字和插入位置判定新增片段，位置無法吻合時比對前後共同文字；片段含簡體專用字時才套用 OpenCC `s2twp`。確認輸入框仍是同一段文字後，才用 `$.prompt.fill` 替換。
- 點一下模式可能直接觸發 `prompt.submit`。外掛記住打字、貼上和已轉換的文字及游標位置，以此判定新增片段。來源為 `composer` 或 `unclassified` 的送出會進入判斷；指令及來自 plugin、Remote Control、排程、通知等其他來源的送出直接放行。
- 清空後送出與暫存草稿相同的文字時，外掛會視為草稿還原。若送出被擋下（drop），且等待期間沒有新的 edit 或 change 事件，就恢復先前記住的文字與游標，讓重試沿用原本的判定。

## 致謝

轉換字典與核心程式來自 [opencc-js](https://github.com/nk2028/opencc-js) 1.0.5（MIT 授權，見 `hooks/vendor/OPENCC-JS-LICENSE.txt`），字典源自 [OpenCC](https://github.com/BYVoid/OpenCC)。

## 授權

MIT，見 [LICENSE](LICENSE)。內含的 opencc-js 程式與字典另依其 MIT 授權（`hooks/vendor/OPENCC-JS-LICENSE.txt`）。
