// 連續聽寫整段轉換與寫回保護的規格測試（bun test / node --test 皆可執行）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { register } from './register.ts'

function host({ onRead } = {}) {
  const handlers = new Map()
  let box = { text: '', cursor: 0 }
  let allowFill = true
  let reads = 0
  let duringFill, duringRead, duringEdit
  const prompt = {
    read: async () => {
      const snapshot = { ...box }
      reads++
      if (onRead) box = onRead(reads, box) ?? box
      if (duringRead) { const f = duringRead; duringRead = undefined; await f() }
      return snapshot
    },
    fill: async ({ text }) => {
      if (duringFill) { const f = duringFill; duringFill = undefined; await f() }
      if (allowFill) box = { text, cursor: text.length }
      return { isFilled: allowFill }
    },
  }
  register((name, handler) => handlers.set(name, handler))
  const api = {
    get text() { return box.text },
    allow(value) { allowFill = value },
    onNextFill(f) { duringFill = f },
    onNextRead(f) { duringRead = f },
    onNextEdit(f) { duringEdit = f },
    async change(text, cursor = text.length, origin = { kind: 'engine' }) {
      box = { text, cursor }
      return handlers.get('prompt.change')({ prompt }, { text, cursor, origin }, async () => ({ text }))
    },
    async edit(start, end, inputText) {
      const before = { ...box }
      const e = { ...before, start, end, inputText, origin: { kind: 'composer' } }
      return handlers.get('prompt.edit')({ prompt }, e, async () => {
        box = { text: before.text.slice(0, start) + inputText + before.text.slice(end), cursor: start + inputText.length }
        if (duringEdit) { const f = duringEdit; duringEdit = undefined; await f() }
        return { ...box }
      })
    },
    async submit(text = box.text) {
      return handlers.get('prompt.submit')({ prompt }, { text, wait: false, origin: { kind: 'composer' } }, async e => e.text)
    },
  }
  return api
}

test('分段聽寫用整段原文轉換：鼠 → 鼠标 得 滑鼠', async () => {
  const c = host()
  await c.change('鼠')
  assert.equal(c.text, '鼠')
  await c.change('鼠标')
  assert.equal(c.text, '滑鼠')
})

test('已轉換的段落後面接著聽寫，片語仍整段轉換', async () => {
  const c = host()
  await c.change('软件')
  assert.equal(c.text, '軟體')
  await c.change('軟體鼠')
  await c.change('軟體鼠标')
  assert.equal(c.text, '軟體滑鼠')
})

test('手打的前文保留，後面的連續聽寫整段轉換', async () => {
  const c = host()
  await c.edit(0, 0, '这段是我打的：')
  await c.change('这段是我打的：鼠', 8)
  await c.change('这段是我打的：鼠标', 9)
  assert.equal(c.text, '这段是我打的：滑鼠')
})

test('純共用字的聽寫維持原樣', async () => {
  const c = host()
  await c.change('打')
  await c.change('打印')
  assert.equal(c.text, '打印')
})

test('手動編輯打斷連續聽寫後，只轉新增的那段', async () => {
  const c = host()
  await c.change('鼠')
  await c.edit(1, 1, '甲')
  await c.change('鼠甲标', 3)
  assert.equal(c.text, '鼠甲標')
})

test('其他外掛送來相同文字也視為打斷，不借用上一段的簡體判定', async () => {
  const c = host()
  await c.change('软件')
  assert.equal(c.text, '軟體')
  await c.change('軟體', 2, { kind: 'plugin', name: 'other-fixture' })
  await c.change('軟體打印')
  assert.equal(c.text, '軟體打印')
})

test('本外掛自己的寫回通知不打斷連續聽寫', async () => {
  const c = host()
  await c.change('鼠')
  await c.change('鼠', 1, { kind: 'plugin', name: 'voice-zh-tw' })
  await c.change('鼠标')
  assert.equal(c.text, '滑鼠')
})

test('文字與游標都沒變的空編輯不打斷連續聽寫', async () => {
  const c = host()
  await c.change('鼠')
  await c.edit(1, 1, '')
  await c.change('鼠标')
  assert.equal(c.text, '滑鼠')
})

test('讀取期間使用者又打了字：不寫回，新輸入保留', async () => {
  const c = host({ onRead: (n, box) => n === 1 ? { text: box.text + ' 甲乙', cursor: box.text.length + 3 } : undefined })
  await c.change('软件')
  assert.equal(c.text, '软件 甲乙')
})

test('寫回途中發生編輯或寫回被拒，都不會拋出例外', async () => {
  const c = host()
  c.onNextFill(async () => { await c.edit(2, 2, ' 甲') })
  await c.change('软件')
  await c.change(c.text + '鼠标')
  c.allow(false)
  await c.change(c.text + '网络')
  await c.edit(0, 0, '乙')
  c.allow(true)
  await c.change('丙' + c.text, 1)
  assert.equal(typeof await c.submit(), 'string')
})

test('引擎改寫到手打文字周圍時不建立連續段，手打的「文件」之後不被轉成「檔案」', async () => {
  const c = host()
  await c.change('甲')
  await c.edit(1, 1, '文件')
  await c.change('甲文件乙', 4)
  await c.change('丙文件丁', 4)
  await c.change('丙文件丁软', 5)
  assert.equal(c.text, '丙文件丁軟')
})

test('手打期間收到 engine 通知，這次手打仍算打斷', async () => {
  const c = host()
  c.onNextEdit(async () => { await c.change('文件', 2) })
  await c.edit(0, 0, '文件')
  await c.change('文件软', 3)
  assert.equal(c.text, '文件軟')
})

test('寫回前讀取期間被打斷，處理完不會把連續狀態設回來', async () => {
  const c = host()
  await c.change('软件')
  c.onNextRead(async () => { await c.edit(0, 0, '') })
  await c.change('軟體鼠标')
  assert.equal(c.text, '軟體滑鼠')
  await c.change('軟體滑鼠打印')
  assert.equal(c.text, '軟體滑鼠打印')
})

test('點一下模式接在同一段後面送出，用整段原文轉換', async () => {
  const c = host()
  await c.change('软件')
  assert.equal(await c.submit('軟體打印'), '軟體列印')
})

test('隨機事件序列：不拋例外，手打的字一個都不被改掉或吃掉', async () => {
  const pieces = ['软', '件', '鼠', '标', '打', '印', '网', '络', '这', '个']
  const typed = ['甲', '乙', '丙', '文件']
  let seed = 20261101
  const rand = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  for (let round = 0; round < 500; round++) {
    const c = host()
    const count = { 甲: 0, 乙: 0, 丙: 0, 文件: 0 }
    for (let step = 0; step < 12; step++) {
      const op = rand(5)
      if (op <= 1) {
        await c.change(c.text + pieces[rand(pieces.length)])
      } else if (op === 2) {
        const ch = typed[rand(typed.length)]
        const at = rand(c.text.length + 1)
        await c.edit(at, at, ch)
        count[ch]++
      } else if (op === 3) {
        c.allow(rand(4) !== 0)
      } else {
        await c.edit(c.text.length, c.text.length, '')
      }
    }
    const sent = await c.submit()
    for (const ch of typed) {
      // 「文件」可能被之後的手打字插進中間拆開；只數「文」：聽寫片段沒有這個字，被轉成「檔案」就會少掉
      const mark = ch === '文件' ? '文' : ch
      const n = sent.split(mark).length - 1
      assert.equal(n, count[ch], `round ${round}: ${ch} 應有 ${count[ch]} 個，送出「${sent}」`)
    }
  }
})
