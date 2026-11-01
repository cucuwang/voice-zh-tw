# 開發與檢查

[繁體中文 README](../README.md) · [English README](../README.en.md)

從 repo 根目錄執行以下指令。外掛沒有 npm 依賴，不需執行 `npm install` 或 `bun install`。

## 本機模擬與 CLI 測試

需要 Node.js 22.18 以上版本且啟用 TypeScript 執行功能，已測 24.21.0。這組檢查不需要 Claude Code、麥克風、登入或 API key。

```sh
node demo/simulate.mjs --quick
node --test demo/simulate.test.mjs
```

第一行執行實際 hook 程式並核對四組轉換。第二行檢查示範 CLI 的說明、錯誤參數與快速模式，預期為 3 pass、0 fail。

## Claude Code hook 測試

需要支援 mod 測試的 Claude Code CLI，已測版本為 2.1.308。

```sh
claude --version
claude plugin test .
```

預期為 42 pass、0 fail，其中 `hooks/regression.test.ts` 包含 36 案。測試涵蓋聽寫轉換、送出來源、草稿還原、drop 重試，以及混合打字與聽寫。

`claude-code/testing` 由 CLI 測試 runtime 提供，直接執行 `bun test` 會找不到這個模組。這些測試使用模擬的 prompt 事件，不需要真實麥克風或模型請求。

另有兩個不依賴 CLI 測試 runtime 的規格測試，直接以 Bun 執行：

```sh
bun test hooks/continuous-dictation.test.mjs hooks/register.regression.test.mjs
```

預期為 42 pass、0 fail。`continuous-dictation` 涵蓋分段聽寫整段轉換（鼠 → 鼠标 得 滑鼠）、各種打斷情形、寫回前再讀一次，以及 500 組隨機事件序列下手打文字不被改動或遺失；`register.regression` 是 10/23 修正分支留下的回歸案例。

## 靜態檢查

```sh
claude plugin validate .
node --check demo/simulate.mjs
node --check demo/simulate.test.mjs
git diff --check
```

`validate` 檢查 manifest 與 hook 定義；目前可能出現未提供外掛目錄圖示的警告。專案尚未設定獨立的 lint 指令。`tsconfig.json` 引用的 `.claude-plugin/types/tsconfig.json` 未隨 repo 提供，因此現有 checkout 也沒有可獨立執行的 `tsc` 檢查環境。請以 CLI 的 hook 測試搭配上述靜態檢查驗證變更。

## 從 checkout 試裝

在 repo 根目錄執行以下指令，可安裝目前的本機內容。

```sh
claude plugin install voice-zh-tw --marketplace "$PWD"
claude plugin list
```

本機 marketplace 來源請用絕對路徑。Claude Code 2.1.308 的 `--marketplace .` 會回報 `Invalid marketplace source format`。成功時應顯示 `Successfully installed plugin: voice-zh-tw@voice-zh-tw`；再開新的 Claude Code session 進行 README 的第一次聽寫驗證。

需要隔離既有使用者設定時，可將 `CLAUDE_CONFIG_DIR` 指向新建的暫存目錄，並在同一個 shell 執行所有 `claude` 指令。

```sh
export CLAUDE_CONFIG_DIR="$(mktemp -d)"
claude plugin install voice-zh-tw --marketplace "$PWD"
claude plugin list
claude plugin test .
```

暫存設定內的安裝不會沿用原有 Claude Code 登入。要驗證真實 `/voice`，請回到已登入的原有 shell，依 README 安裝並測試。
