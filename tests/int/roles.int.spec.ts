import { describe, expect, it } from 'vitest'

import { Users } from '@/collections/Users'

const accessArgs = (user: unknown) => ({
  req: { user },
  slug: Users.slug,
})

describe('Users role access configuration', () => {
  it('defines the three supported roles as a multi-select field', () => {
    const rolesField = Users.fields.find((field) => 'name' in field && field.name === 'roles')

    expect(rolesField).toMatchObject({
      hasMany: true,
      name: 'roles',
      type: 'select',
    })
    expect('options' in rolesField! && rolesField.options).toEqual([
      { label: 'Administrador', value: 'admin' },
      { label: 'Control de stock', value: 'stock' },
      { label: 'Administración', value: 'administracion' },
    ])
  })

  it('allows only administrators into Payload Admin', () => {
    expect(Users.access?.admin?.(accessArgs({ roles: ['admin'] }) as never)).toBe(true)
    expect(Users.access?.admin?.(accessArgs({ roles: ['stock'] }) as never)).toBe(false)
    expect(Users.access?.admin?.(accessArgs({ roles: ['administracion'] }) as never)).toBe(false)
  })

  it('allows administrators to manage users while non-admins can only update themselves', () => {
    expect(Users.access?.create?.(accessArgs({ roles: ['admin'] }) as never)).toBe(true)
    expect(Users.access?.create?.(accessArgs({ roles: ['stock'] }) as never)).toBe(false)
    expect(Users.access?.delete?.(accessArgs({ roles: ['administracion'] }) as never)).toBe(false)
    expect(
      Users.access?.update?.({ ...accessArgs({ id: 'user-1', roles: ['stock'] }), id: 'user-1' } as never),
    ).toBe(true)
    expect(
      Users.access?.update?.({ ...accessArgs({ id: 'user-1', roles: ['stock'] }), id: 'user-2' } as never),
    ).toBe(false)
  })

  it('lets only administrators change the roles field', () => {
    const rolesField = Users.fields.find((field) => 'name' in field && field.name === 'roles')
    const access = 'access' in rolesField! ? rolesField.access : undefined

    expect(access?.read?.({ ...accessArgs({ id: 'user-1', roles: ['stock'] }), id: 'user-1' } as never)).toBe(true)
    expect(access?.read?.({ ...accessArgs({ id: 'user-1', roles: ['stock'] }), id: 'user-2' } as never)).toBe(false)
    expect(access?.update?.(accessArgs({ roles: ['admin'] }) as never)).toBe(true)
    expect(access?.update?.(accessArgs({ roles: ['stock'] }) as never)).toBe(false)
  })

  it('assigns admin to the first user even when no role is submitted', async () => {
    const hook = Users.hooks?.beforeValidate?.[0]
    const result = await (hook as (args: unknown) => Promise<unknown>)({
      data: { username: '99.887.766' },
      operation: 'create',
      req: { payload: { find: async () => ({ totalDocs: 0 }) } },
    })

    expect(result).toMatchObject({ roles: ['admin'], username: '99887766' })
  })

  it('protects the last administrator from losing admin role', async () => {
    const hook = Users.hooks?.beforeChange?.[0]
    const promise = (hook as (args: unknown) => Promise<unknown>)({
      data: { roles: [] },
      operation: 'update',
      originalDoc: { roles: ['admin'] },
      req: { payload: { find: async () => ({ totalDocs: 1 }) } },
    })

    await expect(promise).rejects.toThrow('No se puede quitar ni eliminar al último administrador.')
  })

  it('protects the last administrator from deletion', async () => {
    const hook = Users.hooks?.beforeDelete?.[0]
    const promise = (hook as (args: unknown) => Promise<unknown>)({
      id: 'admin-1',
      req: {
        payload: {
          find: async () => ({ totalDocs: 1 }),
          findByID: async () => ({ roles: ['admin'] }),
        },
      },
    })

    await expect(promise).rejects.toThrow('No se puede quitar ni eliminar al último administrador.')
  })
})
