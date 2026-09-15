import { describe, expect, it } from 'vitest'

import {
  assertMemberInvariants,
  assertMultiGroupReasons,
  buildMemberDrafts,
  parseCreateGroupInput,
  parseDeactivateMemberInput,
} from './validation'

describe('group validation', () => {
  it('parses a valid create group payload with only a referent', () => {
    const result = parseCreateGroupInput({
      referenteContributorId: 'contrib-1',
      observations: 'Grupo inicial',
    })

    expect(result).toEqual({
      referenteContributorId: 'contrib-1',
      observations: 'Grupo inicial',
      members: undefined,
    })
  })

  it('builds a single-member group from the referent', () => {
    const drafts = buildMemberDrafts(
      { referenteContributorId: 'contrib-1' },
      'kinship-referente',
    )

    expect(drafts).toEqual([
      {
        contributorId: 'contrib-1',
        kinshipId: 'kinship-referente',
        isReferent: true,
      },
    ])
  })

  it('rejects groups without members when invariants are checked directly', () => {
    expect(() => assertMemberInvariants([])).toThrow('al menos un integrante')
  })

  it('rejects duplicate members in the same group', () => {
    expect(() =>
      buildMemberDrafts(
        {
          referenteContributorId: 'contrib-1',
          members: [{ contributorId: 'contrib-1', kinshipId: 'kinship-2' }],
        },
        'kinship-referente',
      ),
    ).toThrow('no debe repetirse')
  })

  it('requires a reason when adding a member with active memberships elsewhere', () => {
    const drafts = buildMemberDrafts(
      {
        referenteContributorId: 'contrib-1',
        members: [{ contributorId: 'contrib-2', kinshipId: 'kinship-2' }],
      },
      'kinship-referente',
    )

    expect(() =>
      assertMultiGroupReasons(
        drafts,
        new Map([
          [
            'contrib-2',
            [{ contributorId: 'contrib-2', groupId: 'group-9', groupReferenteContributorId: 'contrib-9' }],
          ],
        ]),
      ),
    ).toThrow('motivo')

    expect(() =>
      assertMultiGroupReasons(
        drafts.map((draft) =>
          draft.contributorId === 'contrib-2'
            ? { ...draft, multiGroupReason: 'Convivencia parcial' }
            : draft,
        ),
        new Map([
          [
            'contrib-2',
            [{ contributorId: 'contrib-2', groupId: 'group-9', groupReferenteContributorId: 'contrib-9' }],
          ],
        ]),
      ),
    ).not.toThrow()
  })

  it('parses member deactivation with a required reason', () => {
    expect(parseDeactivateMemberInput({ endReason: 'Cambio de domicilio' })).toEqual({
      endReason: 'Cambio de domicilio',
    })
    expect(() => parseDeactivateMemberInput({})).toThrow('endReason')
  })
})
