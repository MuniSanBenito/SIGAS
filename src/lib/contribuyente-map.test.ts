import { describe, expect, it } from 'vitest'

import { buildContribuyenteSearchParams, mapFormToExternalPayload, splitNombreApellido } from './contribuyente-map'

describe('contribuyente-map', () => {
  it('maps the friendly form to the external contributor shape', () => {
    const result = mapFormToExternalPayload({
      apellido: 'Pérez',
      barrio: 'Centro',
      cuit: '20-30123456-3',
      direccion: 'Calle 123',
      dni: '30123456',
      email: 'juan@example.com',
      fechaNacimiento: '1980-01-02',
      nombre: 'Juan',
      telefono: '3430000000',
    })

    expect(result).toEqual({
      data: {
        barrio: 'Centro',
        cuit: '20-30123456-3',
        domicilio: 'Calle 123',
        email: 'juan@example.com',
        fecha_nacimiento: '1980-01-02',
        nombre: 'Pérez Juan',
        numero_documento: '30123456',
        telefono_web: '3430000000',
      },
    })
  })

  it('preserves empty strings so PATCH can clear external values', () => {
    const result = mapFormToExternalPayload({ nombre: 'Juan', apellido: 'Pérez', email: '', telefono: '' })

    expect(result.data).toMatchObject({ email: '', telefono_web: '' })
  })

  it('allows partial updates without requiring a name', () => {
    expect(mapFormToExternalPayload({ email: 'nuevo@example.com' }, { requireName: false })).toEqual({
      data: { email: 'nuevo@example.com' },
    })
    expect(mapFormToExternalPayload({}, { requireName: false })).toMatchObject({
      error: 'Debés enviar al menos un campo para actualizar.',
    })
  })

  it('rejects a form without a name', () => {
    expect(mapFormToExternalPayload({ dni: '30123456' })).toMatchObject({
      error: 'Nombre y apellido son obligatorios.',
    })
  })

  it('rejects non-text form values at the API boundary', () => {
    expect(mapFormToExternalPayload({ apellido: 'Pérez', nombre: 123 })).toMatchObject({
      error: 'El campo nombre debe ser texto.',
    })
  })

  it('builds the three-way search filters for numeric input', () => {
    const params = buildContribuyenteSearchParams('12345', 20)

    expect(params.get('limit')).toBe('20')
    expect(params.get('where[or][0][nombre][contains]')).toBe('12345')
    expect(params.get('where[or][1][numero_documento][contains]')).toBe('12345')
    expect(params.get('where[or][2][numero_contribuyente][equals]')).toBe('12345')
  })

  it('splits the external surname-first name for editing', () => {
    expect(splitNombreApellido('Pérez Juan')).toEqual({ apellido: 'Pérez', nombre: 'Juan' })
  })
})
