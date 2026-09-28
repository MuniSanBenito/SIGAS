/**
 * @vitest-environment node
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { changeOwnPassword } from '@/account/password-service'
import config from '@/payload.config'
import type { User } from '@/payload-types'

describe('own password change', () => {
  let payload: Payload
  let user: User
  const username = `996${Date.now().toString().slice(-6)}`

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = await payload.create({
      collection: 'users',
      data: {
        password: 'clave-actual',
        roles: ['stock'],
        username,
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    if (!user) return
    await payload.delete({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    })
  })

  it('replaces the password and keeps the previous one from logging in', async () => {
    await changeOwnPassword(
      { payload, user } as never,
      {
        confirmPassword: 'nueva-clave',
        currentPassword: 'clave-actual',
        newPassword: 'nueva-clave',
      },
    )

    await expect(
      payload.login({
        collection: 'users',
        data: { password: 'clave-actual', username },
      }),
    ).rejects.toThrow()

    const session = await payload.login({
      collection: 'users',
      data: { password: 'nueva-clave', username },
    })

    expect(session.user.username).toBe(username)
  })
})
