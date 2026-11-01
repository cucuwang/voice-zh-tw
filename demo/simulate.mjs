import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { register } from '../hooks/register.ts'

let options
try {
  options = parseArgs({
    options: {
      quick: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  }).values
} catch (error) {
  console.error(error.message)
  console.error('Run node demo/simulate.mjs --help for usage.')
  process.exit(1)
}

if (options.help) {
  console.log(`Usage: node demo/simulate.mjs [--quick] [--help]

Simulate dictation with the real conversion hooks; no microphone or API key needed.
Requires Node.js 22.18 or later with TypeScript execution enabled.

  --quick     Skip presentation delays and check all four examples.
  -h, --help  Show this help.`)
  process.exit(0)
}

// Local prompt adapter only. Conversion and source filtering run in the real hooks.
const handlers = new Map()
let box = ''
const prompt = {
  read: async () => ({ text: box, cursor: box.length }),
  fill: async ({ text }) => {
    box = text
    return { isFilled: true }
  },
}
register((name, handler) => handlers.set(name, handler))

async function emit(name, event) {
  const handler = handlers.get(name)
  assert.ok(handler, `Missing hook: ${name}`)
  return handler({ prompt }, event, async (e) => {
    box = name === 'prompt.edit'
      ? e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
      : e.text
    return { text: box, cursor: box.length }
  })
}

async function edit(text) {
  await emit('prompt.edit', {
    text: box, cursor: box.length, start: 0, end: box.length,
    inputText: text, origin: { kind: 'composer' },
  })
}

const pause = (ms) => options.quick ? Promise.resolve() : sleep(ms)
async function example(title, label, input, expected, action) {
  console.log(`\n${title}`)
  console.log(`${label} → ${input}`)
  await pause(1600)
  const result = await action()
  assert.equal(result, expected)
  console.log(`轉換後       → ${result}`)
  await pause(3400)
}

console.log('voice-zh-tw  /voice 繁簡轉換示範')
console.log('模擬聽寫輸入（文字由腳本餵入，非真實語音辨識）')
console.log('實際 hooks + 內附 OpenCC s2twp；本示範不錄音。')
await pause(3000)

const first = '我现在讲的是繁体中文，帮我检查软件的内存设置'
await example('01  按住模式 · prompt.change', '模擬聽寫輸入', first,
  '我現在講的是繁體中文，幫我檢查軟體的記憶體設定', async () => {
    await emit('prompt.change', {
      text: first, cursor: first.length, origin: { kind: 'engine' },
    })
    return box
  })

await edit('')
const second = '这个视频的信息要发到网络上'
await example('02  點一下模式 · prompt.submit', '模擬聽寫輸入', second,
  '這個影片的資訊要發到網路上', async () => {
    const result = await emit('prompt.submit', {
      text: second, wait: false, origin: { kind: 'composer' },
    })
    return result.text
  })

await edit('')
const typed = '这是我打的简体，软件设置保持原样'
await example('03  一般打字 · 保留原文', '一般打字輸入', typed, typed, async () => {
  await edit(typed)
  const result = await emit('prompt.submit', {
    text: typed, wait: false, origin: { kind: 'composer' },
  })
  return result.text
})

const prefix = '这段是我打的：'
await edit(prefix)
const mixed = `${prefix}帮我检查软件的内存设置`
await example('04  打字接聽寫 · 保留打字，只轉新增聽寫', '模擬混合輸入', mixed,
  `${prefix}幫我檢查軟體的記憶體設定`, async () => {
    const result = await emit('prompt.submit', {
      text: mixed, wait: false, origin: { kind: 'composer' },
    })
    return result.text
  })

console.log('\n示範完成 · 4 組結果已核對 · 模擬輸入，無錄音')
await pause(2000)
