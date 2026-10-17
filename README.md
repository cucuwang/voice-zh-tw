# voice-zh-tw

Claude Code 的 `/voice` 聽寫目前沒有中文選項，講中文時轉出來的字大多是簡體。這個 mod 會在聽寫文字寫進輸入框時，自動把它換成台灣繁體，並套用台灣用語：

| 聽寫原文 | 換成 |
| --- | --- |
| 我现在讲的是繁体中文 | 我現在講的是繁體中文 |
| 帮我检查软件的内存设置 | 幫我檢查軟體的記憶體設定 |

只轉聽寫來的文字。自己打的字、貼上的內容、已經是繁體的文字都不會被改。

## 安裝

在 Claude Code 的輸入框輸入：

```
/plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

出現 `Add marketplace?` 時按 `y`，範圍選 user（直接按 Enter）。裝好立即生效，之後每次開 Claude Code 也會自動載入。

從 shell 安裝：

```
claude plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

桌面版 app（不能用 `/plugin`）：點輸入框旁的 **+** → **Plugins** → **Add marketplace**，填 `cucuwang/voice-zh-tw`，再按 **Add plugin**。

## 使用建議

- 按住空白鍵的模式有一小段暖機時間，畫面出現 `listening…` 才開始錄，太早開口會漏掉開頭一兩個字。改用 `/voice tap`（點一下開始、再點一下送出）可以避開。
- 按 Esc 取消聽寫時，輸入框會還原成原本的內容；如果那段內容是簡體，也會一起被轉成繁體。

## 運作方式

- 按住空白鍵模式：聽寫結果寫進輸入框時，Claude Code 觸發 `prompt.change` 事件（來源 `engine`）。mod 用 OpenCC 的 `s2twp` 規則（簡體 → 繁體 → 台灣用字與用語）轉換，確認輸入框仍是同一段文字後，用 `$.prompt.fill` 替換。
- 點一下模式：聽寫完會直接送出，不會先觸發 `prompt.change`。mod 平時記著輸入框裡打字、貼上（`prompt.edit`）與已換好的文字；送出時（`prompt.submit`）多出來的那段就是聽寫內容，只轉那一段再送出。
- 打字、貼上和歷史紀錄叫回的文字都不轉。

## 致謝

轉換字典與核心程式來自 [opencc-js](https://github.com/nk2028/opencc-js) 1.0.5（MIT 授權，見 `hooks/vendor/OPENCC-JS-LICENSE.txt`），字典源自 [OpenCC](https://github.com/BYVoid/OpenCC)。

## 授權

MIT，見 [LICENSE](LICENSE)。內含的 opencc-js 程式與字典另依其 MIT 授權（`hooks/vendor/OPENCC-JS-LICENSE.txt`）。
