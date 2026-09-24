import { describe, expect, it } from 'vitest'

import {
  assertRecipeDiffReason,
  expandProposalLines,
  parseConfirmDeliveryInput,
  parseProposalInput,
  recipeTotalsDiffer,
} from './validation'

describe('delivery validation', () => {
  const base = {
    groupId: 'group-1',
    receiverContributorId: 'contrib-1',
    receiverIsThirdParty: false,
    deliveryDate: '2026-09-15',
    bundles: [{ bundleVersionId: 'bv-1', quantity: 1 }],
    lines: [{ productId: 'prod-1', quantity: 2 }],
  }

  it('parses a valid group delivery', () => {
    const result = parseConfirmDeliveryInput(base)
    expect(result.groupId).toBe('group-1')
    expect(result.receiverIsThirdParty).toBe(false)
  })

  it('always rejects a person destination', () => {
    expect(() => parseConfirmDeliveryInput({ ...base, destinoTipo: 'persona' })).toThrow(
      'siempre es un grupo familiar',
    )
    expect(() =>
      parseConfirmDeliveryInput({ ...base, destinatarioContribuyenteId: 'contrib-9' }),
    ).toThrow('siempre es un grupo familiar')
    expect(() => parseConfirmDeliveryInput({ ...base, motivoEntregaSinGrupo: 'x' })).toThrow(
      'siempre es un grupo familiar',
    )
  })

  it('requires authorization for third-party receivers', () => {
    expect(() =>
      parseConfirmDeliveryInput({ ...base, receiverIsThirdParty: true }),
    ).toThrow('autorización y motivo')

    const result = parseConfirmDeliveryInput({
      ...base,
      receiverIsThirdParty: true,
      receiverAuthorizationReason: 'Vecina autorizada por el referente',
    })
    expect(result.receiverAuthorizationReason).toContain('Vecina')
  })

  it('requires stock lines or an assistance', () => {
    expect(() => parseConfirmDeliveryInput({ ...base, bundles: [], lines: [], assistances: [] })).toThrow(
      'al menos un bolsón, un producto o una asistencia',
    )
    expect(() => parseConfirmDeliveryInput({ ...base, lines: [{ productId: 'p', quantity: 0 }] })).toThrow(
      'entero positivo',
    )
  })

  it('accepts an assistance-only delivery and checks fields by kind', () => {
    const atmospheric = parseConfirmDeliveryInput({
      ...base,
      bundles: [],
      lines: [],
      assistances: [{ kind: 'atmospheric', description: 'Temporal de septiembre' }],
    })
    expect(atmospheric.assistances).toEqual([{ kind: 'atmospheric', description: 'Temporal de septiembre' }])

    const money = parseConfirmDeliveryInput({
      ...base,
      bundles: [],
      lines: [],
      assistances: [{ kind: 'money', description: 'Ayuda extraordinaria', amountPesos: 15000 }],
    })
    expect(money.assistances[0]?.amountPesos).toBe(15000)

    expect(() =>
      parseConfirmDeliveryInput({
        ...base,
        bundles: [],
        lines: [],
        assistances: [{ kind: 'atmospheric', description: 'Temporal', amountPesos: 1000 }],
      }),
    ).toThrow('no lleva monto')

    expect(() =>
      parseConfirmDeliveryInput({
        ...base,
        bundles: [],
        lines: [],
        assistances: [{ kind: 'materials', description: 'Chapas' }],
      }),
    ).toThrow('cantidad')

    expect(() =>
      parseConfirmDeliveryInput({
        ...base,
        bundles: [],
        lines: [],
        assistances: [{ kind: 'money', description: 'Ayuda' }],
      }),
    ).toThrow('amountPesos')

    expect(() =>
      parseConfirmDeliveryInput({
        ...base,
        bundles: [],
        lines: [],
        assistances: [{ kind: 'orthopedic', description: 'Muletas', quantity: 1, amountPesos: 10 }],
      }),
    ).toThrow('no lleva monto')
  })

  it('keeps an optional report id', () => {
    const result = parseConfirmDeliveryInput({ ...base, reportId: 'report-1' })
    expect(result.reportId).toBe('report-1')
  })

  it('rejects duplicated real lines', () => {
    expect(() =>
      parseConfirmDeliveryInput({
        ...base,
        lines: [
          { productId: 'p', quantity: 1 },
          { productId: 'p', quantity: 2 },
        ],
      }),
    ).toThrow('no puede repetirse')
  })

  it('rejects invalid delivery dates', () => {
    expect(() => parseConfirmDeliveryInput({ ...base, deliveryDate: '2026-13-40' })).toThrow('fecha válida')
  })

  it('expands bundle recipes into proposed lines', () => {
    const proposed = expandProposalLines(
      { bundles: [{ bundleVersionId: 'bv-1', quantity: 2 }], looseProducts: [{ productId: 'p-loose', quantity: 3 }] },
      () => [{ productId: 'p-1', quantity: 2 }],
    )
    expect(proposed).toEqual([
      { productId: 'p-1', quantity: 4, bundleVersionId: 'bv-1' },
      { productId: 'p-loose', quantity: 3 },
    ])
  })

  it('requires a reason when real lines differ from the recipe', () => {
    const expected = new Map([['p-1', 4]])
    expect(recipeTotalsDiffer(expected, [{ productId: 'p-1', quantity: 3 }])).toBe(true)
    expect(recipeTotalsDiffer(expected, [{ productId: 'p-1', quantity: 4 }])).toBe(false)
    expect(() => assertRecipeDiffReason(expected, [{ productId: 'p-1', quantity: 3 }])).toThrow('motivo')
    expect(() =>
      assertRecipeDiffReason(expected, [{ productId: 'p-1', quantity: 3 }], 'Faltó stock, se ajustó'),
    ).not.toThrow()
  })

  it('requires at least a bundle or a loose product for proposals', () => {
    expect(() => parseProposalInput({ bundles: [], looseProducts: [] })).toThrow('al menos un bolsón')
  })
})
