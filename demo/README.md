# 模擬聽寫示範

這段約 30 秒的終端機示範使用腳本餵入的簡體文字，呈現 voice-zh-tw 的台灣繁體與用語轉換。畫面開頭顯示「模擬聽寫輸入（文字由腳本餵入，非真實語音辨識）」。分享影片時請保留這段聲明。

腳本直接匯入 [`hooks/register.ts`](../hooks/register.ts) 的 `register`，用本機輸入框 adapter 依序觸發 `prompt.change`、`prompt.edit` 與 `prompt.submit`。轉換與來源判斷都由原本的 hooks 執行，使用專案內附的 OpenCC s2twp。示範涵蓋按住模式、點一下模式、一般打字保留原文，以及打字接聽寫時只轉新增文字。每組結果都有斷言，結果不符時程式會失敗。

此為模擬，沒有呼叫麥克風、語音辨識服務或 Claude Code runtime。voice-zh-tw 負責聽寫文字進入輸入框後的轉換。

## 執行腳本

從 repo 根目錄執行，需要支援直接執行 TypeScript 的 Node.js 22.18 以上版本。本次驗證使用 Node.js 24.21.0，無須安裝依賴。

```sh
node demo/simulate.mjs
```

略過展示用的等待時間，可快速核對四組結果。

```sh
node demo/simulate.mjs --quick
```

## 重錄 GIF 與 MP4

需要 VHS、ffmpeg、ttyd，以及 VHS 使用的瀏覽器環境。終端機字型須能顯示中文，例如 macOS 的 PingFang TC。先檢查 tape 語法，再錄製。

```sh
vhs validate demo/voice-zh-tw.tape
vhs demo/voice-zh-tw.tape
```

輸出為 `demo/voice-zh-tw.gif` 與 `demo/voice-zh-tw.mp4`。已有成品時，請先備份再重錄。VHS 錄製會啟動瀏覽器，請在允許啟動瀏覽器的環境執行。

錄完檢查中文顯示、長句是否完整、模擬聲明是否可讀，以及影片長度是否落在 20–40 秒。可用 ffprobe 讀回 MP4 時長。

```sh
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 demo/voice-zh-tw.mp4
```
