export type ReconfigurationEntityStatus =
  | 'PENDING'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'CANCEL'

export type ActionExecutionStatus =
  | 'PENDING'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ROLLED_BACK'

export type BatchCriticality = 'CRITICAL' | 'NORMAL' | 'OPTIONAL'

export type ReconfigurationActionType =
  | 'ADD_VLAN'
  | 'DELETE_VLAN'
  | 'CREATE_SUBINTERFACE'
  | 'DELETE_SUBINTERFACE'
  | 'SET_ACCESS'
  | 'SET_TRUNK'
  | 'EDIT_TRUNK'
  | 'SWITCH_VLAN'

export interface ReconfigurationVlanAction {
  actionType: ReconfigurationActionType
  id: string
  deviceId: string
  status: ActionExecutionStatus
  params?: Record<string, unknown>
  previousState?: unknown
  targetState?: unknown
}

export interface ReconfigurationBatchView {
  id: string
  criticality: BatchCriticality
  status: ReconfigurationEntityStatus
  /** Время последнего обновления статуса батча в БД */
  updatedAt?: string | null
  actions: ReconfigurationVlanAction[]
}

/** Запись истории смены статуса из reconfiguration_task_status. */
export interface ReconfigurationTaskStatusHistoryEntry {
  id: string
  taskId: string
  /** null — изменение на уровне задачи (видно для всех батчей) */
  batchId: string | null
  status: ReconfigurationEntityStatus
  updatedAt: string
  updatedBy: string | null
  statusReason: string | null
}

export interface ReconfigurationTask {
  id: string
  initiatedBy: string | null
  createdAt: string
  status: ReconfigurationEntityStatus
  /** Время последнего обновления статуса задачи в БД */
  updatedAt?: string | null
  /** Автор последнего обновления статуса в БД */
  updatedBy?: string | null
  /** Описание ошибки или причина отмены из БД */
  statusReason?: string | null
  batches: ReconfigurationBatchView[]
}

/** Тело POST /api/v1/reconfiguration/tasks (совпадает с бэкенд-DTO). */
export type ReconfigurationTaskCreateRequest = {
  id?: string
  initiatedBy?: string
  createdAt?: string
  status?: ReconfigurationEntityStatus
  batches: ReconfigurationBatchCreatePayload[]
}

export type ReconfigurationBatchCreatePayload = {
  id: string
  criticality: BatchCriticality
  status: ReconfigurationEntityStatus
  actions: ReconfigurationVlanActionCreatePayload[]
}

export type ReconfigurationVlanActionCreatePayload =
  | {
      actionType: 'ADD_VLAN'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { vlanId: number; name: string }
    }
  | {
      actionType: 'DELETE_VLAN'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { vlanId: number }
    }
  | {
      actionType: 'CREATE_SUBINTERFACE'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { parentInterface: string; vlanId: number; ipAddress: string }
    }
  | {
      actionType: 'DELETE_SUBINTERFACE'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { parentInterface: string; vlanId: number }
    }
  | {
      actionType: 'SET_ACCESS'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { port: string; vlanId: number }
      previousState?: ReconfigurationPortStateTrunkPayload
      targetState?: ReconfigurationPortStateAccessPayload
    }
  | {
      actionType: 'SET_TRUNK'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: {
        port: string
        allowedVlans: number[]
        nativeVlanId: number | null
      }
      previousState?: ReconfigurationPortStateAccessPayload
      targetState?: ReconfigurationPortStateTrunkPayload
    }
  | {
      actionType: 'EDIT_TRUNK'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: {
        port: string
        allowedVlans: number[]
        nativeVlanId: number | null
      }
      previousState?: ReconfigurationEditTrunkStatePayload
      targetState?: ReconfigurationEditTrunkStatePayload
    }
  | {
      actionType: 'SWITCH_VLAN'
      id: string
      deviceId: string
      status: ActionExecutionStatus
      params: { port: string; targetVlanId: number }
      previousState?: ReconfigurationSwitchVlanPortStatePayload
      targetState?: ReconfigurationSwitchVlanPortStatePayload
    }

export type InterfacePortMode = 'ACCESS' | 'TRUNK'

export type ReconfigurationPortStateAccessPayload = {
  mode: InterfacePortMode
  vlanId: number
}

export type ReconfigurationPortStateTrunkPayload = {
  mode: InterfacePortMode
  allowedVlans: number[]
}

export type ReconfigurationSwitchVlanPortStatePayload = { vlanId: number }

export type ReconfigurationEditTrunkStatePayload = {
  allowedVlans: number[]
  nativeVlanId: number | null
}
