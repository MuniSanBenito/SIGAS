/**
 * Apertura de depósito a partir de las planillas de septiembre 2026.
 *
 * Decisiones de carga (el modelo no tiene color ni unidad distinta de "unidad"):
 * - El color o detalle va en el nombre.
 * - Paquetes ya convertidos a unidades: invisibles 804, velitas 96, lápices 48, cortauñas 6.
 * - Aritos brillantes: la planilla dice "93/35 pares". Se cargan 35 pares.
 * - Aritos perlitas: la planilla dice "40/39". Se cargan 40.
 * - Cantidad vacía: se crea el producto y no se mueve stock.
 * - Cantidad 0: se crea el producto con saldo 0.
 * - Ítems repetidos entre planillas del ministerio NO se suman. Llevan sufijo de planilla.
 * - "Colero con moño" (57) y "Coleros con moño, bolsa" (59) quedan separados: pueden ser el mismo recuento.
 * - Ningún producto controla lote. Después del primer movimiento eso no se puede cambiar.
 */

export type SeedItem = {
  category: string
  detail?: string
  name: string
  note?: string
  quantity: number | null
  source: string
}

export const SEED_OPERATIONAL_DATE = '2026-09-25'

export const SEED_CATEGORIES = [
  'Alimentos',
  'Limpieza',
  'Indumentaria',
  'Calzado',
  'Accesorios',
  'Higiene personal',
  'Cotillón',
  'Hogar',
  'Tecnología',
  'Librería y útiles',
  'Descanso y abrigo',
  'Contingencia',
] as const

const deposito = 'Depósito — planilla general'
const alimentos = 'Ministerio de Desarrollo Humano — alimentos'
const ministerioRopa = 'Ministerio de Desarrollo Humano — planilla ropa y accesorios'
const ministerioHogar = 'Ministerio de Desarrollo Humano — planilla hogar y varios'
const varios = 'Depósito — colchones, limpieza y contingencia'

export const SEED_ITEMS: SeedItem[] = [
  { category: 'Cotillón', detail: 'Rojo', name: 'Masajeador para cabeza rojo', quantity: 337, source: deposito },
  { category: 'Cotillón', name: 'Nariz de payaso', quantity: 134, source: deposito },
  { category: 'Accesorios', name: 'Espejito pastillero', quantity: 0, source: deposito },
  { category: 'Cotillón', name: 'Muñeca de yeso', quantity: 6, source: deposito },
  { category: 'Cotillón', name: 'Cartel de feliz cumpleaños', quantity: 101, source: deposito },
  { category: 'Cotillón', name: 'Mazos de cartas', quantity: 8, source: deposito },
  {
    category: 'Accesorios',
    name: 'Invisibles para cabello',
    note: '67 paquetes de 12. Se cargan 804 unidades.',
    quantity: 804,
    source: deposito,
  },
  { category: 'Accesorios', detail: 'Varios', name: 'Colero con moño', quantity: 57, source: deposito },
  {
    category: 'Cotillón',
    name: 'Velitas de cumpleaños',
    note: '4 paquetes de 24. Se cargan 96 unidades.',
    quantity: 96,
    source: deposito,
  },
  { category: 'Indumentaria', detail: 'Blancas', name: 'Remeras manga corta blancas', quantity: 42, source: deposito },
  { category: 'Indumentaria', detail: 'Blancas', name: 'Camisas blancas', quantity: 0, source: deposito },
  { category: 'Indumentaria', detail: 'Blancas', name: 'Chombas blancas', quantity: 0, source: deposito },
  {
    category: 'Accesorios',
    detail: 'Varios colores',
    name: 'Aritos brillantes',
    note: 'Planilla: 93/35 pares. Se cargan 35 pares.',
    quantity: 35,
    source: deposito,
  },
  {
    category: 'Accesorios',
    detail: 'Varios colores',
    name: 'Aritos perlitas',
    note: 'Planilla: 40/39. Se cargan 40.',
    quantity: 40,
    source: deposito,
  },
  { category: 'Indumentaria', name: 'Ropa interior (fajas de dama)', quantity: 27, source: deposito },
  { category: 'Accesorios', detail: 'Dorado', name: 'Cintos de cadena dorados', quantity: 13, source: deposito },
  { category: 'Accesorios', detail: 'Plateados', name: 'Cintos de cadena plateados', quantity: 2, source: deposito },
  { category: 'Librería y útiles', detail: 'Violeta', name: 'Cartucheras con pines violeta', quantity: 8, source: deposito },
  { category: 'Librería y útiles', detail: 'Rosado', name: 'Cartucheras con pines rosado', quantity: 7, source: deposito },
  { category: 'Librería y útiles', detail: 'Verde', name: 'Cartucheras con pines verde', quantity: 3, source: deposito },
  { category: 'Librería y útiles', detail: 'Rojo', name: 'Cartucheras con pines rojo', quantity: 1, source: deposito },
  { category: 'Librería y útiles', detail: 'Varios', name: 'Cartucheras', quantity: 6, source: deposito },
  { category: 'Librería y útiles', name: 'Cartucheras nene', quantity: 100, source: deposito },
  { category: 'Librería y útiles', name: 'Cartucheras nena', quantity: 95, source: deposito },
  { category: 'Cotillón', detail: 'Varios', name: 'Silbatos', quantity: 48, source: deposito },
  { category: 'Tecnología', name: 'Cargadores de celulares', quantity: 56, source: deposito },
  {
    category: 'Librería y útiles',
    name: 'Lápices de colores',
    note: '4 cajas. Se cargan 48 unidades.',
    quantity: 48,
    source: deposito,
  },
  { category: 'Higiene personal', name: 'Cortauñas', note: '1 caja. Se cargan 6 unidades.', quantity: 6, source: deposito },
  { category: 'Tecnología', name: 'Caja funda celular', quantity: 308, source: deposito },
  { category: 'Tecnología', name: 'Funda celular', quantity: 158, source: deposito },
  { category: 'Higiene personal', name: 'Arqueador de pestañas', quantity: 368, source: deposito },
  { category: 'Cotillón', name: 'Láser', quantity: 25, source: deposito },
  { category: 'Tecnología', name: 'Fundas para CD', quantity: 6, source: deposito },
  { category: 'Calzado', name: 'Ojotas', quantity: 0, source: deposito },
  { category: 'Calzado', name: 'Pantuflas', quantity: 2, source: deposito },
  { category: 'Hogar', name: 'Cortina de baño', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Short nena', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Musculosa niño', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Enterito niño', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Pañuelos de mano de hombre', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Camisa manga corta hombre', quantity: 0, source: deposito },
  { category: 'Indumentaria', detail: 'Azul', name: 'Pullover dama azul', quantity: 1, source: deposito },
  { category: 'Indumentaria', name: 'Camperita dama', quantity: 1, source: deposito },
  { category: 'Indumentaria', name: 'Calza dama', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Short niño', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Short dama', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Medias largas', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Medias cortas', note: '7 pares.', quantity: 7, source: deposito },
  { category: 'Indumentaria', name: 'Campera temporada verano', quantity: 0, source: deposito },
  { category: 'Indumentaria', name: 'Buzo de niño', quantity: 1, source: deposito },
  { category: 'Higiene personal', name: 'Cepillos de dientes', quantity: 137, source: deposito },
  { category: 'Cotillón', name: 'Rompecabezas', quantity: 6, source: deposito },
  { category: 'Cotillón', name: 'Anteojos de cotillón con luces', quantity: 5, source: deposito },
  { category: 'Tecnología', name: 'Funda tablet con teclado', quantity: 26, source: deposito },
  { category: 'Hogar', name: 'Bombillas de mate', quantity: 188, source: deposito },
  { category: 'Indumentaria', name: 'Gorras de lana', quantity: 3, source: deposito },
  { category: 'Indumentaria', name: 'Bermuda hombre', quantity: 0, source: deposito },
  { category: 'Cotillón', name: 'Angelitos', quantity: 12, source: deposito },
  { category: 'Cotillón', name: 'Cinta criolla', quantity: 3, source: deposito },
  { category: 'Indumentaria', name: 'Pañuelos de cuello de dama', quantity: 156, source: deposito },
  { category: 'Hogar', name: 'Funda de almohada', quantity: 3, source: deposito },
  { category: 'Hogar', name: 'Camino de mesa', quantity: 28, source: deposito },
  { category: 'Accesorios', detail: 'Blanco', name: 'Cinto blanco', quantity: 35, source: deposito },
  {
    category: 'Accesorios',
    name: 'Coleros con moño (bolsa)',
    note: '1 bolsa, 59 con moños. Revisar si es el mismo ítem que "Colero con moño" (57).',
    quantity: 59,
    source: deposito,
  },
  { category: 'Accesorios', name: 'Coleros sueltos', quantity: 42, source: deposito },
  { category: 'Cotillón', name: 'Varita que emite luz', quantity: 2, source: deposito },

  { category: 'Alimentos', name: 'Fideos', quantity: 272, source: alimentos },
  { category: 'Alimentos', name: 'Leche en polvo', quantity: 270, source: alimentos },
  { category: 'Alimentos', name: 'Polenta', quantity: 250, source: alimentos },
  { category: 'Alimentos', name: 'Arroz', quantity: 230, source: alimentos },
  { category: 'Alimentos', name: 'Aceite', quantity: 225, source: alimentos },
  { category: 'Alimentos', name: 'Puré de tomate', quantity: 216, source: alimentos },
  { category: 'Alimentos', name: 'Harina', quantity: 390, source: alimentos },
  { category: 'Alimentos', name: 'Azúcar', quantity: 40, source: alimentos },
  { category: 'Alimentos', name: 'Yerba', quantity: 230, source: alimentos },
  { category: 'Alimentos', name: 'Lentejas', quantity: 240, source: alimentos },
  { category: 'Alimentos', name: 'Cacao', quantity: 179, source: alimentos },
  { category: 'Alimentos', name: 'Dulce de leche', quantity: 198, source: alimentos },
  { category: 'Alimentos', name: 'Mermelada', quantity: 327, source: alimentos },
  { category: 'Alimentos', name: 'Galletitas', note: 'Cantidad no informada en la planilla.', quantity: null, source: alimentos },

  { category: 'Indumentaria', detail: 'Varios', name: 'Gorras (planilla ropa)', note: 'Cantidad no informada.', quantity: null, source: ministerioRopa },
  { category: 'Indumentaria', detail: 'Varios', name: 'Sweater', quantity: 8, source: ministerioRopa },
  { category: 'Indumentaria', detail: 'Varios', name: 'Blusas', quantity: 69, source: ministerioRopa },
  { category: 'Indumentaria', detail: 'Varios', name: 'Corpiños', quantity: 34, source: ministerioRopa },
  { category: 'Indumentaria', detail: 'Varios', name: 'Tobilleras', quantity: 45, source: ministerioRopa },
  { category: 'Higiene personal', detail: 'Varios', name: 'Neceser (planilla ropa)', note: 'Cantidad no informada.', quantity: null, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Bolsos (planilla ropa)', quantity: 0, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Cintos (donación ministerio)', quantity: 111, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Carteras (planilla ropa)', quantity: 0, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Carteras niñas', quantity: 27, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Monederos (planilla ropa)', quantity: 120, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Corbatas', note: 'Cantidad no informada.', quantity: null, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Chalinas', quantity: 250, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Paraguas', quantity: 0, source: ministerioRopa },
  { category: 'Accesorios', detail: 'Varios', name: 'Colitas para el pelo', quantity: 370, source: ministerioRopa },

  { category: 'Hogar', detail: 'Varios', name: 'Cuadros de pared', quantity: 87, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Tazas', quantity: 97, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Valija con morral', quantity: 8, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Maletines', quantity: 8, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Carteras (planilla hogar)', quantity: 19, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Carameleras', quantity: 11, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Copas', quantity: 18, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Repasadores', quantity: 72, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Portavelas', quantity: 48, source: ministerioHogar },
  { category: 'Higiene personal', detail: 'Varios', name: 'Neceser (planilla hogar)', quantity: 22, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Bolsos (planilla hogar)', quantity: 13, source: ministerioHogar },
  { category: 'Tecnología', detail: 'Varios', name: 'Parlantes', note: 'Cantidad no informada.', quantity: null, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Vinchas', quantity: 35, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Monederos (planilla hogar)', quantity: 132, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Llaveros', quantity: 329, source: ministerioHogar },
  { category: 'Accesorios', detail: 'Varios', name: 'Bijouterie', quantity: 1200, source: ministerioHogar },
  { category: 'Librería y útiles', detail: 'Varios', name: 'Botones', quantity: 47000, source: ministerioHogar },
  { category: 'Higiene personal', detail: 'Varios', name: 'Cepillo para pelo', quantity: 72, source: ministerioHogar },
  { category: 'Indumentaria', detail: 'Varios', name: 'Gorras (planilla hogar)', quantity: 128, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Canasto de ropa', quantity: 21, source: ministerioHogar },
  { category: 'Librería y útiles', detail: 'Varios', name: 'Cierres', quantity: 4950, source: ministerioHogar },
  { category: 'Cotillón', detail: 'Varios', name: 'Arbolitos navideños', quantity: 19, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Posavasos', quantity: 20, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Vasos', quantity: 90, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Manoplas', quantity: 15, source: ministerioHogar },
  { category: 'Hogar', detail: 'Varios', name: 'Budineras', quantity: 11, source: ministerioHogar },
  { category: 'Librería y útiles', detail: 'Varios', name: 'Ojalillos', quantity: 18000, source: ministerioHogar },

  { category: 'Descanso y abrigo', name: 'Colchones 1 plaza', quantity: 25, source: varios },
  { category: 'Descanso y abrigo', name: 'Colchones niño', quantity: 3, source: varios },
  { category: 'Descanso y abrigo', name: 'Frazadas', quantity: 25, source: varios },
  { category: 'Alimentos', name: 'Módulos de mercadería', quantity: 30, source: varios },
  { category: 'Limpieza', name: 'Lavandina 1 litro', quantity: 48, source: varios },
  { category: 'Limpieza', name: 'Lavandina 5 litros', quantity: 7, source: varios },
  { category: 'Hogar', name: 'Vasos descartables', quantity: 50, source: varios },
  { category: 'Limpieza', name: 'Rollos de nylon finos', quantity: 4, source: varios },
  { category: 'Contingencia', name: 'Bolsas de arena', quantity: 121, source: varios },
  { category: 'Limpieza', name: 'Bolsas de consorcio 45x60', note: '20 paquetes.', quantity: 20, source: varios },
]
