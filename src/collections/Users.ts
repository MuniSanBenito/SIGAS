import type { CollectionConfig } from 'payload'

import { normalizeDni } from '../normalizeDni'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'username',
  },
  auth: {
    loginWithUsername: {
      allowEmailLogin: false,
      requireEmail: false,
    },
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data?.username) return data

        return {
          ...data,
          username: normalizeDni(data.username),
        }
      },
    ],
  },
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
