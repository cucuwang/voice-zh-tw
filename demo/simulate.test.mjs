import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = new URL('./simulate.mjs', import.meta.url)
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(script), ...args], {
  encoding: 'utf8',
  timeout: 15_000,
})

test('help explains prerequisites without starting the presentation', () => {
  for (const flag of ['--help', '-h']) {
    const result = run(flag)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage: node demo\/simulate\.mjs/)
    assert.match(result.stdout, /--quick/)
    assert.doesNotMatch(result.stdout, /01  按住模式/)
  }
})

test('unknown options and positional arguments fail with a recovery command', () => {
  for (const arg of ['--quik', 'quick']) {
    const result = run(arg)
    assert.equal(result.status, 1, result.stderr)
    assert.match(result.stderr, /node demo\/simulate\.mjs --help/)
    assert.equal(result.stdout, '')
  }
})

test('quick mode verifies all four examples without presentation delays', () => {
  const result = run('--quick')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /4 組結果已核對/)
  assert.match(result.stdout, /这段是我打的：幫我檢查軟體的記憶體設定/)
})
