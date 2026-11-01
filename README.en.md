# voice-zh-tw

[繁體中文](README.md)

Convert Simplified Chinese from Claude Code `/voice` dictation to Traditional Chinese with Taiwanese terminology.

| Dictated text | Converted text |
| --- | --- |
| 我现在讲的是繁体中文 | 我現在講的是繁體中文 |
| 帮我检查软件的内存设置 | 幫我檢查軟體的記憶體設定 |

Typed, pasted, and recalled history text keeps its original wording. A segment identified as new dictation is converted only if it contains Simplified-only characters. Pure Traditional text such as 軟件 stays unchanged; the mixed segment 软件和軟件 becomes 軟體和軟體.

![Simulated voice-zh-tw conversion](demo/voice-zh-tw.gif)

The demo feeds scripted text through the actual hooks. It does not record audio or measure speech recognition accuracy. Watch the [MP4](demo/voice-zh-tw.mp4) or see the [demo guide](demo/README.md) for recording instructions.

## Prerequisites

- Claude Code CLI, signed in, with `/voice` available for your account and environment. Check `/voice` in Claude Code and grant your terminal microphone access.
- A Claude Code version supporting `modules` in `hooks.json` and the `prompt.*` events. This guide was tested with **Claude Code 2.1.308**. The minimum compatible version has not been established.
- Access to GitHub during installation. The converter and dictionaries are bundled. No `npm install`, Bun, or additional API key is needed for conversion. Claude Code supplies authentication and access to `/voice`.

Without a microphone or Claude Code setup, start with the [offline demo](#offline-demo-without-a-microphone).

## Install

Enter this command in Claude Code's input box.

```text
/plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

If prompted with `Add marketplace?`, press `y`. Choose the user scope, which is the default.

Alternatively, install from your shell.

```sh
claude plugin install voice-zh-tw --marketplace cucuwang/voice-zh-tw
```

Look for `Successfully installed plugin: voice-zh-tw@voice-zh-tw`. After a shell install, start a new Claude Code session to load the plugin. Future sessions load it automatically. Check that the plugin is listed and enabled with this shell command.

```sh
claude plugin list
```

These instructions were checked with Claude Code CLI. Desktop installation and hook loading still need verification in the desktop app.

## First use

1. Open a new Claude Code session and enter `/voice` to enable dictation.
2. Leave the input box empty. Hold Space, wait for `listening…`, and say “幫我檢查軟體的記憶體設定”.
3. Release Space and wait for the text to appear. If speech recognition returns Simplified Chinese, the input should show “幫我檢查軟體的記憶體設定”. Hold-to-talk mode lets you inspect the text before submitting it.

Speech recognition can mishear words. This plugin handles character and terminology conversion. Use the offline demo to check conversion independently.

## Offline demo without a microphone

Install Git and **Node.js 22.18 or later** with TypeScript execution enabled. Tested with Node.js 24.21.0. This workflow needs no Claude Code, account, or API key and sends no conversation.

```sh
git clone https://github.com/cucuwang/voice-zh-tw.git
cd voice-zh-tw
node --version
node demo/simulate.mjs --quick
```

If you already have a checkout, run the last two commands from its root. No dependency installation is needed. Four examples should pass, ending with `示範完成 · 4 組結果已核對 · 模擬輸入，無錄音`. In the mixed example, the typed prefix “这段是我打的：” stays intact and the dictated suffix becomes “幫我檢查軟體的記憶體設定”.

The demo runs the actual hooks and OpenCC with a local prompt adapter. Follow “First use” to verify microphone input, speech recognition, and plugin loading in Claude Code. Run `node demo/simulate.mjs --help` for options. See [development checks](docs/development.md) for tests.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| `claude: command not found` | Follow the [Claude Code setup guide](https://code.claude.com/docs/en/setup), open a new terminal, and run `claude --version`. |
| `unknown option '--marketplace'` or unsupported `modules` | Run `claude --version` and update to a version supporting these features. This guide was tested with 2.1.308. |
| The plugin is installed, but dictation stays in Simplified Chinese | Check `claude plugin list`, enable the plugin if needed, and start a new session. Test with `/voice`; pasted Simplified Chinese stays unchanged. |
| `/voice` is unavailable or no sound is captured | Check Claude Code sign-in, feature availability, and microphone permissions, then test native dictation. The plugin processes the resulting text. |
| Node.js cannot load `.ts` files or reports TypeScript syntax errors | Check `node --version` for 22.18 or later and ensure Node.js TypeScript execution is enabled. |
| `Cannot find module 'claude-code/testing'` | Run hook tests with `claude plugin test .`. See [development checks](docs/development.md). |

## Usage notes

- Hold-to-talk has a short warm-up period. Wait for `listening…` before speaking. `/voice tap` starts recording on one tap and submits on the next, so it may send a message immediately.
- Pressing Esc cancels dictation and restores the previous input. If the restored text matches the draft saved when the input was cleared, the plugin preserves it.

## How it works

- Hold-to-talk dictation triggers `prompt.change` with an `engine` origin. The plugin identifies the new segment using known text and the insertion position, falling back to common prefixes and suffixes if the position does not match. It applies OpenCC `s2twp` only when the segment contains Simplified-only characters, then uses `$.prompt.fill` if the input still matches.
- Tap-to-talk can submit directly through `prompt.submit`. The plugin tracks typed, pasted, and converted text and the cursor position to identify the new segment. Submissions with `composer` or `unclassified` origins are checked; commands and submissions from plugins, Remote Control, schedules, notifications, and other origins pass through unchanged.
- A submission matching the draft saved when the input was cleared is treated as a restored draft. If a submission is dropped and no edit or change arrives while it is pending, the plugin restores the previous known text and cursor for the retry.

## Credits and license

The converter and dictionaries come from [opencc-js](https://github.com/nk2028/opencc-js) 1.0.5, whose dictionaries derive from [OpenCC](https://github.com/BYVoid/OpenCC).

MIT. See [LICENSE](LICENSE) and the bundled [opencc-js MIT license](hooks/vendor/OPENCC-JS-LICENSE.txt).
