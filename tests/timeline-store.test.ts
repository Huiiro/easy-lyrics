import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTimelineStore } from '../src/renderer/src/stores/timeline'

describe('timeline loop state', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('retains the loop range until it is explicitly disabled', () => {
    const store = useTimelineStore()
    store.enableLoop(2, 3)

    expect(store.loopEnabled).toBe(true)
    expect(store.loopStart).toBe(2)
    expect(store.loopEnd).toBe(3)

    store.disableLoop()
    expect(store.loopEnabled).toBe(false)
    expect(store.loopStart).toBeNull()
    expect(store.loopEnd).toBeNull()
  })

  it('ignores invalid loop ranges without closing the current loop', () => {
    const store = useTimelineStore()
    store.enableLoop(2, 3)
    store.enableLoop(4, 4)

    expect(store.loopEnabled).toBe(true)
    expect(store.loopStart).toBe(2)
    expect(store.loopEnd).toBe(3)
  })
})
