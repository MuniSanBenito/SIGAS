import { getPayload } from 'payload'

import { hasRole, type Role } from '../../src/access/roles.js'
import config from '../../src/payload.config.js'

export type TestUser = {
  password: string
  roles: Role[]
  username: string
}

export const testUser: TestUser = {
  password: 'test',
  roles: ['admin'],
  username: '99887766',
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(user: TestUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: {
      username: {
        equals: user.username,
      },
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'users',
      data: user,
      id: existing.docs[0].id,
    })
    return
  }

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      username: {
        equals: user.username,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: user,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(user: TestUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    where: {
      username: {
        equals: user.username,
      },
    },
  })

  const existingUser = existing.docs[0]
  if (!existingUser) return

  if (hasRole(existingUser, 'admin')) {
    const administrators = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 2,
      where: {
        roles: {
          in: ['admin'],
        },
      },
    })

    if (administrators.totalDocs <= 1) return
  }

  await payload.delete({
    collection: 'users',
    id: existingUser.id,
  })
}
