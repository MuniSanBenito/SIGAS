export const entryReasons = ['purchase', 'donation', 'adjustment'] as const
export const exitReasons = ['expiration', 'loss', 'breakage', 'adjustment'] as const

export type EntryReason = (typeof entryReasons)[number]
export type ExitReason = (typeof exitReasons)[number]
export type MovementMode = 'entry' | 'exit' | 'physicalCount'

export type StockCommandBase = {
  productId: string
  lotId?: string
  operationalDate: string
  observation?: string
  source?: string
}

export type StockEntryCommand = StockCommandBase & {
  mode: 'entry'
  quantity: number
  reason: EntryReason
}

export type StockExitCommand = StockCommandBase & {
  mode: 'exit'
  quantity: number
  reason: ExitReason
}

export type PhysicalCountCommand = StockCommandBase & {
  mode: 'physicalCount'
  countedQuantity: number
}

export type StockMovementCommand = StockEntryCommand | StockExitCommand | PhysicalCountCommand

export type StockCommandInput = {
  operationKey: string
  movement: StockMovementCommand
}

export type AdjustmentDirection = 'increase' | 'decrease'

export type StockMovementRecord = {
  id: string
  movementType: 'entry' | 'exit' | 'adjustment'
  quantity: number
  adjustmentDirection?: AdjustmentDirection
  reason: string
  productId: string
  lotId?: string
  operationalDate: string
  operationKey: string
}

export type StockBalanceRecord = {
  id: string
  balanceKey: string
  productId: string
  lotId?: string
  quantity: number
}
