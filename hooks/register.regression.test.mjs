import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convertNew, register } from './register.ts'

// In-memory host adapter. These tests exercise the hooks, not a running composer.
function composer({ fillResult = { isFilled: true }, fillError } = {}) {
  const handlers = new Map()
  let box = { text: '', cursor: 0 }
  const fills = []
  const prompt = {
    read: async () => ({ ...box }),
    fill: async ({ text }) => {
      fills.push(text)
      if (fillError) throw fillError
      if (fillResult.isFilled) box = { text, cursor: text.length }
      return fillResult
    },
  }
  register((name, handler) => handlers.set(name, handler))
  return {
    get text() { return box.text },
    fills,
    async edit(text, cursor = text.length) {
      const before = box
      return handlers.get('prompt.edit')({ prompt }, {
        text: before.text, cursor: before.cursor, start: 0, end: before.text.length,
        inputText: text, origin: { kind: 'composer' },
      }, async () => (box = { text, cursor }))
    },
    async change(text, cursor = text.length, kind = 'engine') {
      const event = { text, cursor, origin: { kind } }
      return handlers.get('prompt.change')({ prompt }, event, async () => {
        box = { text, cursor }
        return { text }
      })
    },
    async submit(text = box.text, command) {
      return handlers.get('prompt.submit')({ prompt }, {
        text, command, wait: false, origin: { kind: 'composer' },
      }, async event => {
        box = { text: '', cursor: 0 }
        return event.text
      })
    },
  }
}

test('F1: engine insertion before a repeated manual character uses the caret', async () => {
  const c = composer()
  await c.edit('这', 0)
  await c.change('这里这', 2)
  assert.equal(c.text, '這裡这')
})

test('F1: conversion helper accepts the insertion start for repeated text', () => {
  assert.equal(convertNew('这', '这里这', 0), '這裡这')
})

test('F1: without a caret the helper keeps the shared prefix', () => {
  assert.equal(convertNew('这', '这里这'), '这裡這')
})

test('F1: an explicit caret can preserve a repeated manual prefix', () => {
  assert.equal(convertNew('这', '这里这', 3), '这裡這')
})

test('conversion helper preserves its two-argument prefix and suffix behavior', () => {
  assert.equal(convertNew('前软件后', '前鼠标后'), '前滑鼠后')
})

test('F1: direct submit uses the last manual caret to locate repeated text', async () => {
  const c = composer()
  await c.edit('这', 0)
  assert.equal(await c.submit('这里这'), '這裡这')
})

test('F1: insertion in the middle preserves both manual sides', async () => {
  const c = composer()
  await c.edit('这这', 1)
  await c.change('这这里这', 3)
  assert.equal(c.text, '这這裡这')
})

for (const path of ['change', 'submit']) {
  test(`N1: ${path} starts a new dictation span beyond the old manual suffix`, async () => {
    const c = composer()
    await c.edit('这', 0)
    await c.change('软件这', 2)
    assert.equal(c.text, '軟體这')
    if (path === 'change') {
      await c.change('軟體这软件这', 6)
      assert.equal(c.text, '軟體这軟體這')
    } else {
      assert.equal(await c.submit('軟體这软件这'), '軟體这軟體這')
    }
  })
}

test('N1: change starts a new dictation span before the old manual prefix', async () => {
  const c = composer()
  await c.edit('这', 1)
  await c.change('这软件', 3)
  assert.equal(c.text, '这軟體')
  await c.change('这软件这軟體', 3)
  assert.equal(c.text, '這軟體这軟體')
})

test('N1: direct submit can still revise raw dictation before a manual suffix', async () => {
  const c = composer()
  await c.edit('这', 0)
  await c.change('软件这', 2)
  assert.equal(await c.submit('软件和鼠标这'), '軟體和滑鼠这')
})

for (const [first, complete, expected] of [['打', '打印', '打印'], ['鼠', '鼠标', '滑鼠']]) {
  test(`F2: incremental dictation converts the whole phrase ${complete}`, async () => {
    const c = composer()
    await c.change(first)
    await c.change(complete)
    assert.equal(c.text, expected)
  })
}

test('F2: phrase updates preserve manual prefix and suffix', async () => {
  const c = composer()
  await c.edit('软件这', 2)
  await c.change('软件鼠这', 3)
  await c.change('软件鼠标这', 4)
  assert.equal(c.text, '软件滑鼠这')
})

test('F2: a growing dictation converts both software and mouse as whole phrases', async () => {
  const c = composer()
  await c.edit('这段是我打的：')
  await c.change('这段是我打的：软件')
  await c.change('这段是我打的：软件鼠标')
  assert.equal(c.text, '这段是我打的：軟體滑鼠')
})

test('F2: converted software followed by incremental mouse stays one dictation', async () => {
  const c = composer()
  await c.change('软件')
  await c.change('軟體鼠')
  await c.change('軟體鼠标')
  assert.equal(c.text, '軟體滑鼠')
})

test('F2: a previously converted simplified span still enables phrase conversion for new shared characters', async () => {
  const c = composer()
  await c.change('软件')
  await c.change('軟體打印')
  assert.equal(c.text, '軟體列印')
})

test('F2: submit uses the raw dictation when a converted span is extended', async () => {
  const c = composer()
  await c.change('软件')
  assert.equal(await c.submit('軟體打印'), '軟體列印')
})

test('F2: direct submit completes a phrase started by engine updates', async () => {
  const c = composer()
  await c.change('打')
  assert.equal(await c.submit('打印'), '打印')
})

test('F2: successive raw engine snapshots can revise an already converted phrase', async () => {
  const c = composer()
  await c.change('软件')
  await c.change('软件和鼠')
  await c.change('软件和鼠标')
  assert.equal(c.text, '軟體和滑鼠')
})

test('F3: rejected fill keeps the source state for submit', async () => {
  const c = composer({ fillResult: { isFilled: false } })
  await c.change('软件')
  assert.equal(c.text, '软件')
  assert.equal(await c.submit(), '軟體')
})

test('F3: a thrown fill keeps the source state for submit', async () => {
  const c = composer({ fillError: new Error('fill failed') })
  await assert.rejects(c.change('软件'), /fill failed/)
  assert.equal(await c.submit(), '軟體')
})

test('F3: rejected incremental fill preserves the earlier dictation span', async () => {
  const c = composer({ fillResult: { isFilled: false } })
  await c.edit('软件这', 2)
  await c.change('软件鼠这', 3)
  await c.change('软件鼠标这', 4)
  assert.equal(await c.submit(), '软件滑鼠这')
})

test('manual typing and paste remain unchanged on submit', async () => {
  const c = composer()
  await c.edit('这是我贴上的软件')
  assert.equal(await c.submit(), '这是我贴上的软件')
})

test('history remains unchanged on change and submit', async () => {
  const c = composer()
  await c.change('历史软件', 4, 'history')
  assert.deepEqual(c.fills, [])
  assert.equal(await c.submit(), '历史软件')
})

test('manual edits end the previous dictation span', async () => {
  const c = composer()
  await c.change('软件')
  await c.edit('軟體，软件')
  await c.change('軟體，软件打印')
  assert.equal(c.text, '軟體，软件打印')
})

test('a cleared composer is not filled by a late engine notification', async () => {
  const handlers = new Map()
  register((name, handler) => handlers.set(name, handler))
  const fills = []
  const $ = { prompt: {
    read: async () => ({ text: '', cursor: 0 }),
    fill: async event => { fills.push(event); return { isFilled: true } },
  } }
  await handlers.get('prompt.submit')($, {
    text: '测试测试', wait: false, origin: { kind: 'composer' },
  }, async event => event.text)
  // The host has already processed this stale event; next() leaves the box empty.
  await handlers.get('prompt.change')($, {
    text: '测试测试', cursor: 4, origin: { kind: 'engine' },
  }, async () => ({ text: '' }))
  assert.deepEqual(fills, [])
})
