import type {
  On, PromptChangeInput, PromptChangeResult, PromptEditInput, PromptEditResult,
  PromptFillInput, PromptOrigin, PromptSubmitInput, PromptSubmitResult,
} from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { hasSimplified } from './vendor/s2twp.js'

// Same engine-event cast as register.test.ts; stubs model the box, not a UI.
type Raise = { prompt: {
  change: (e: PromptChangeInput) => Promise<PromptChangeResult>
  edit: (e: PromptEditInput) => Promise<PromptEditResult>
  submit: (e: PromptSubmitInput) => Promise<PromptSubmitResult>
} }
const raise = ($: unknown) => ($ as Raise).prompt
const fixture = ($: unknown, on: On) => {
  let box = { text: '', cursor: 0 }
  const fills: PromptFillInput[] = []
  const sent: string[] = []
  on('prompt.read', () => ({ value: { ...box } }))
  on('prompt.edit', ($, e) => {
    box = {
      text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end),
      cursor: e.start + e.inputText.length,
    }
    return { ...box }
  })
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push({ ...e })
    // Snapshot index.d.ts:8971 defines replace's end cursor. This is a
    // documented-contract simulation, NOT evidence of the installed UI.
    box = { text: e.text, cursor: e.text.length }
    return { isFilled: true }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  return {
    fills, sent,
    box: () => ({ ...box }),
    type: (text: string) => raise($).edit({
      text: box.text, cursor: box.cursor, start: box.cursor, end: box.cursor,
      inputText: text, origin: { kind: 'composer' },
    }),
    move: (cursor: number) => raise($).edit({
      text: box.text, cursor: box.cursor, start: cursor, end: cursor,
      inputText: '', origin: { kind: 'composer' },
    }),
    change: async (text: string, cursor = text.length,
      origin: PromptChangeInput['origin'] = { kind: 'engine' }) => {
      // change is a notification AFTER the host has already written the box.
      box = { text, cursor }
      await raise($).change({ text, cursor, origin })
    },
    submit: (text = box.text) => raise($).submit({
      text, wait: false, origin: { kind: 'composer' },
    }),
  }
}

// index.d.ts:8471-8473: change.cursor is the caret AFTER the change.
// Both cases have identical strings but different legal caret offsets.
for (const [id, cursor, expected] of [
  ['R01-A', 1, '軟软件'],
  ['R01-B', 2, '软軟件'],
] as const) {
  test(`${id}: change preserves typed characters at the insertion boundary`, async ($, on) => {
    const f = fixture($, on)
    await f.type('软件')
    await f.change('软软件', cursor)
    expect(f.box().text).toEqual(expected)
  })
  test(`${id}-submit: tap submission preserves typed characters`, async ($, on) => {
    const f = fixture($, on)
    await f.type('软件')
    await f.move(cursor - 1)
    await f.submit('软软件')
    expect(f.sent).toEqual([expected])
  })
}

test('R06: replace arguments preserve current behavior; real caret remains HOST_DEPENDENT', async ($, on) => {
  const f = fixture($, on)
  await f.type('前：後')
  await f.change('前：软件後', 4)
  expect(f.fills.map(e => ({ text: e.text, mode: e.mode, hasCursor: 'cursor' in e })))
    .toEqual([{ text: '前：軟體後', mode: 'replace', hasCursor: false }])
  // Do not assert a fake UI cursor or type at the stub's simulated end.
})

test('TW-a: typed 內存和軟件 survives tap dictation', async ($, on) => {
  const f = fixture($, on)
  await f.type('內存和軟件')
  await f.submit('內存和軟件帮我看')
  expect(f.sent).toEqual(['內存和軟件幫我看'])
})

test('TW-b: typed 文件 survives hold dictation', async ($, on) => {
  const f = fixture($, on)
  await f.type('文件')
  await f.change('文件帮我看')
  expect(f.box().text).toEqual('文件幫我看')
})

test('TW-c-edit: all-traditional typed text submits unchanged', async ($, on) => {
  const f = fixture($, on)
  await f.type('這個文件的內存')
  await f.submit()
  expect(f.sent).toEqual(['這個文件的內存'])
})

test('TW-c-untracked: all-traditional text without edit notification stays unchanged', async ($, on) => {
  const f = fixture($, on)
  // Candidate host sequence, not a claim that typing/history omits events.
  await f.submit('這個文件的內存')
  expect(f.sent).toEqual(['這個文件的內存'])
})

test('TW-c-history: recalled traditional text survives a subsequent edit', async ($, on) => {
  const f = fixture($, on)
  await f.change('這個文件的內存', 7, { kind: 'history' })
  await f.type('。')
  await f.submit()
  expect(f.sent).toEqual(['這個文件的內存。'])
})

test('TW-d: mixed dictation uses Taiwan vocabulary as intended', async ($, on) => {
  const f = fixture($, on)
  await f.change('帮我打印文件')
  expect(f.box().text).toEqual('幫我列印檔案')
})

test('TW-e: shared-character dictation is a documented guard tradeoff', async ($, on) => {
  const f = fixture($, on)
  await f.change('打印文件')
  expect(hasSimplified('打印文件')).toEqual(false)
  expect(f.fills).toEqual([])
  expect(f.box().text).toEqual('打印文件')
})

// No Esc-specific origin is defined. engine explicitly includes a draft put
// back (8532); history/undo/plugin cover their respective restoration acts
// (8493-8523). They are conditional sequences, not observed Esc routing.
for (const origin of [
  { kind: 'engine' }, { kind: 'history' }, { kind: 'undo' },
  { kind: 'plugin', name: 'restore-fixture' },
] as const) {
  test(`ESC-${origin.kind}: restoration follows the disclosed origin-dependent limit`, async ($, on) => {
    const f = fixture($, on)
    await f.type('这是草稿')
    await f.change('这是草稿帮我')
    const during = f.box().text
    await f.change('这是草稿', 4, origin)
    await f.submit()
    expect(during).toEqual('这是草稿幫我')
    expect(f.sent).toEqual(['这是草稿'])
  })
}

test('ESC-no-notification: restored draft prefix remains unchanged at submit', async ($, on) => {
  const f = fixture($, on)
  await f.type('这是草稿')
  await f.change('这是草稿帮我')
  // Host silently restores the old box, then submits, with no change hook.
  await f.submit('这是草稿')
  expect(f.sent).toEqual(['这是草稿'])
})

test('ESC-engine-replacement: disclosed limit applies after dictation replaces the draft', async ($, on) => {
  const f = fixture($, on)
  await f.type('这是草稿')
  await f.change('帮我')
  await f.change('这是草稿', 4, { kind: 'engine' })
  await f.submit()
  expect(f.sent).toEqual(['這是草稿'])
})

const submit = ($: unknown, text: string, origin: PromptOrigin = { kind: 'composer' }) =>
  raise($).submit({ text, wait: false, origin })
const typeSoftware = ($: unknown) => raise($).edit({
  text: '', cursor: 0, start: 0, end: 0, inputText: '软件',
  origin: { kind: 'composer' },
} as PromptEditInput)
const change = ($: unknown, text: string, origin: PromptChangeInput['origin']) =>
  raise($).change({ text, cursor: text.length, origin })

const nonDictationOrigins: { id: string; origin: PromptOrigin }[] = [
  { id: 'R02', origin: { kind: 'plugin', name: 'fixture' } },
  { id: 'R03', origin: { kind: 'bridge' } },
  { id: 'R03', origin: { kind: 'scheduled-trigger' } },
]
for (const { id, origin } of nonDictationOrigins) {
  test(`${id}: ${origin.kind} 非聽寫提交保留原文`, async ($, on) => {
    const sent: string[] = []
    on('prompt.submit', ($, e) => {
      sent.push(e.text)
      return { text: e.text }
    })
    await submit($, '软件', origin)
    expect(sent).toEqual(['软件'])
  })
}

test('R04: 打字提交被 drop 後無中間事件重試仍保留原文', async ($, on) => {
  const sent: string[] = []
  on('prompt.edit', () => ({ text: '软件', cursor: 2 }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return sent.length === 1 ? { drop: 'synthetic-block' } : { text: e.text }
  })
  await typeSoftware($)
  const first = await submit($, '软件')
  const second = await submit($, '软件')
  expect(first).toEqual({ drop: 'synthetic-block' })
  expect({ sent, second }).toEqual({ sent: ['软件', '软件'], second: { text: '软件' } })
})

test('R05: fill 拒絕保留原框，同一聽寫可重試且提交仍轉換', async ($, on) => {
  const box = '软件'
  const requested: string[] = []
  const sent: string[] = []
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    requested.push(e.text)
    return { isFilled: false }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await change($, box, { kind: 'engine' })
  await change($, box, { kind: 'engine' })
  await submit($, box)
  // Private `known` is not observable. Assert the refusal/recovery contract,
  // rather than inventing a success report the handler never returns.
  expect({ box, requested, sent }).toEqual({
    box: '软件', requested: ['軟體', '軟體'], sent: ['軟體'],
  })
})

test('R07: 條件序列 edit → clear → 原稿 submit 保留打字原文', async ($, on) => {
  // `clear` exists in the types. Whether the host emits this order before
  // submission is a separate runtime question; this fixture cannot prove it.
  const sent: string[] = []
  on('prompt.edit', () => ({ text: '软件', cursor: 2 }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await typeSoftware($)
  await change($, '', { kind: 'clear' })
  await submit($, '软件')
  expect(sent).toEqual(['软件'])
})

test('R08: change 回傳改字不改框，仍保留歷史原文', async ($, on) => {
  const sent: string[] = []
  // PromptChangeResult explicitly says a hook's own value changes nothing.
  on('prompt.change', () => ({ text: '另一个回传值' }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await change($, '软件', { kind: 'history' })
  await submit($, '软件')
  expect(sent).toEqual(['软件'])
})

test('R08: fill 被另一 hook 改字，plugin change 通知同步最終框', async ($, on) => {
  let box = '软件'
  const requested: string[] = []
  const sent: string[] = []
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    requested.push(e.text)
    box = '软件工具'
    return { isFilled: true }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await change($, box, { kind: 'engine' })
  // The kit's bottom stub is not a Composer. Explicitly raise the engine's
  // documented notification after the fill; change events run one at a time.
  await change($, box, { kind: 'plugin', name: 'voice-zh-tw' })
  await submit($, box)
  expect({ requested, sent }).toEqual({ requested: ['軟體'], sent: ['软件工具'] })
})

test('R07-stash: clear 後 engine 放回草稿不 fill 且原文送出', async ($, on) => {
  const f = fixture($, on)
  await f.type('软件')
  await f.change('', 0, { kind: 'clear' })
  await f.change('软件')
  await f.submit()
  expect(f.fills).toEqual([])
  expect(f.sent).toEqual(['软件'])
})

test('R04-tap: 聽寫提交被 drop 後重試仍轉換聽寫段', async ($, on) => {
  const sent: string[] = []
  on('prompt.edit', () => ({ text: '软件', cursor: 0 }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return sent.length === 1 ? { drop: 'synthetic-block' } : { text: e.text }
  })
  await typeSoftware($)
  const first = await submit($, '软软件')
  const second = await submit($, '软软件')
  expect(first).toEqual({ drop: 'synthetic-block' })
  expect({ sent, second }).toEqual({
    sent: ['軟软件', '軟软件'], second: { text: '軟软件' },
  })
})

test('R02-followup: plugin 提交保留下一次 composer 的打字來源與游標', async ($, on) => {
  const sent: string[] = []
  on('prompt.edit', () => ({ text: '软件', cursor: 0 }))
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  await typeSoftware($)
  await submit($, '软件', { kind: 'plugin', name: 'fixture' })
  await submit($, '软软件')
  expect(sent).toEqual(['软件', '軟软件'])
})

for (const event of ['edit', 'clear'] as const) {
  test(`F1: drop 等待期間 ${event} 清空後的新聽寫仍轉換`, async ($, on) => {
    const sent: string[] = []
    on('prompt.edit', ($, e) => ({ text: e.inputText, cursor: e.inputText.length }))
    on('prompt.change', ($, e) => ({ text: e.text }))
    on('prompt.submit', async (_$, e) => {
      sent.push(e.text)
      if (sent.length === 1) {
        // 在下游回傳 drop 前觸發清空，模擬 submit pending 期間的事件（用外層 $ 觸發）。
        if (event === 'edit') {
          await raise($).edit({
            text: '软件', cursor: 2, start: 0, end: 2, inputText: '',
            origin: { kind: 'composer' },
          })
        } else {
          await change($, '', { kind: 'clear' })
        }
        return { drop: 'blocked' }
      }
      return { text: e.text }
    })
    await typeSoftware($)
    const first = await submit($, '软件')
    const second = await submit($, '软件')
    expect(first).toEqual({ drop: 'blocked' })
    expect({ sent, second }).toEqual({
      sent: ['软件', '軟體'], second: { text: '軟體' },
    })
  })
}

test('F2: stash 在第一個不相等的 engine 更新後失效', async ($, on) => {
  const f = fixture($, on)
  await f.type('hello软件')
  await f.change('', 0, { kind: 'clear' })
  await f.change('hello')
  await f.change('hello软件')
  expect(f.box().text).toEqual('hello軟體')
  expect(f.fills.map(e => e.text)).toEqual(['hello軟體'])
})

test('F2-submit: clear 後送出別的內容，下一次聽寫剛好等於舊草稿仍轉換', async ($, on) => {
  const f = fixture($, on)
  await f.type('软件')
  await f.change('', 0, { kind: 'clear' })
  await f.submit('测试')
  await f.submit('软件')
  expect(f.sent).toEqual(['測試', '軟體'])
})

for (const next of ['submit', 'engine'] as const) {
  test(`F2-command: clear 後送出指令，下一次聽寫（${next}）剛好等於舊草稿仍轉換`, async ($, on) => {
    const f = fixture($, on)
    await f.type('软件')
    await f.change('', 0, { kind: 'clear' })
    await raise($).submit({
      text: '/review', command: { name: 'review', args: '' }, wait: false, origin: { kind: 'composer' },
    } as PromptSubmitInput)
    if (next === 'submit') {
      await f.submit('软件')
      expect(f.sent).toEqual(['/review', '軟體'])
    } else {
      await f.change('软件')
      expect(f.box().text).toEqual('軟體')
    }
  })
}

test('F2-unrelated: stash 期間插進背景通知送出，放回草稿仍不轉', async ($, on) => {
  const f = fixture($, on)
  await f.type('软件')
  await f.change('', 0, { kind: 'clear' })
  await raise($).submit({ text: '背景任务完成', wait: false, origin: { kind: 'task-notification' } })
  await f.change('软件')
  expect(f.fills).toEqual([])
  expect(f.box().text).toEqual('软件')
})
