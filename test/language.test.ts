import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getLanguage,
  initLanguage,
  languageFromLocale,
  setLanguage,
  subscribeLanguage,
} from '../src/client/language.js'

test('the dashboard language store switches, persists, and notifies once per change', () => {
  assert.equal(languageFromLocale('zh-CN'), 'zh')
  assert.equal(languageFromLocale('zh'), 'zh')
  assert.equal(languageFromLocale('en-US'), 'en')
  assert.equal(languageFromLocale(undefined), 'en')

  initLanguage('en')
  assert.equal(getLanguage(), 'en')

  let calls = 0
  const unsubscribe = subscribeLanguage(() => { calls += 1 })
  setLanguage('zh')
  assert.equal(getLanguage(), 'zh')
  assert.equal(calls, 1)
  setLanguage('zh')
  assert.equal(calls, 1, 'an unchanged choice does not notify')
  setLanguage('en')
  assert.equal(getLanguage(), 'en')
  assert.equal(calls, 2)
  unsubscribe()
  setLanguage('zh')
  assert.equal(calls, 2, 'unsubscribed listeners are not called')
  setLanguage('en')
})
