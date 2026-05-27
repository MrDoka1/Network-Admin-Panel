import { v4 as uuidv4 } from 'uuid'
import type {
  BatchCriticality,
  ReconfigurationActionType,
} from '../../types/reconfiguration'

export type DraftBatch = {
  id: string
  criticality: BatchCriticality
  actions: DraftAction[]
}

export type DraftAction =
  | {
      rowKey: string
      actionType: 'ADD_VLAN'
      id: string
      deviceId: string
      vlanId: string
      name: string
    }
  | {
      rowKey: string
      actionType: 'DELETE_VLAN'
      id: string
      deviceId: string
      vlanId: string
    }
  | {
      rowKey: string
      actionType: 'CREATE_SUBINTERFACE'
      id: string
      deviceId: string
      parentInterface: string
      vlanId: string
      ipv4: string
      maskBits: string
    }
  | {
      rowKey: string
      actionType: 'DELETE_SUBINTERFACE'
      id: string
      deviceId: string
      parentInterface: string
      vlanId: string
    }
  | {
      rowKey: string
      actionType: 'SET_ACCESS'
      id: string
      deviceId: string
      port: string
      vlanId: string
      previousAllowedVlanIds: number[]
    }
  | {
      rowKey: string
      actionType: 'SET_TRUNK'
      id: string
      deviceId: string
      port: string
      allowedVlanIds: number[]
      nativeVlanId: string
      previousAccessVlanId: string
    }
  | {
      rowKey: string
      actionType: 'EDIT_TRUNK'
      id: string
      deviceId: string
      port: string
      allowedVlanIds: number[]
      nativeVlanId: string
      previousAllowedVlanIds: number[]
      previousNativeVlanId: string
    }
  | {
      rowKey: string
      actionType: 'SWITCH_VLAN'
      id: string
      deviceId: string
      port: string
      targetVlanId: string
      previousVlanId: string
    }

export function newId(): string {
  return uuidv4()
}

export function emptyBatch(criticality: BatchCriticality): DraftBatch {
  return {
    id: newId(),
    criticality,
    actions: [],
  }
}

export function newDraftAction(kind: ReconfigurationActionType): DraftAction {
  const id = newId()
  const rowKey = newId()
  const deviceId = ''
  switch (kind) {
    case 'ADD_VLAN':
      return {
        rowKey,
        actionType: 'ADD_VLAN',
        id,
        deviceId,
        vlanId: '',
        name: '',
      }
    case 'DELETE_VLAN':
      return { rowKey, actionType: 'DELETE_VLAN', id, deviceId, vlanId: '' }
    case 'CREATE_SUBINTERFACE':
      return {
        rowKey,
        actionType: 'CREATE_SUBINTERFACE',
        id,
        deviceId,
        parentInterface: '',
        vlanId: '',
        ipv4: '',
        maskBits: '24',
      }
    case 'DELETE_SUBINTERFACE':
      return {
        rowKey,
        actionType: 'DELETE_SUBINTERFACE',
        id,
        deviceId,
        parentInterface: '',
        vlanId: '',
      }
    case 'SET_ACCESS':
      return {
        rowKey,
        actionType: 'SET_ACCESS',
        id,
        deviceId,
        port: '',
        vlanId: '',
        previousAllowedVlanIds: [],
      }
    case 'SET_TRUNK':
      return {
        rowKey,
        actionType: 'SET_TRUNK',
        id,
        deviceId,
        port: '',
        allowedVlanIds: [],
        nativeVlanId: '',
        previousAccessVlanId: '',
      }
    case 'EDIT_TRUNK':
      return {
        rowKey,
        actionType: 'EDIT_TRUNK',
        id,
        deviceId,
        port: '',
        allowedVlanIds: [],
        nativeVlanId: '',
        previousAllowedVlanIds: [],
        previousNativeVlanId: '',
      }
    case 'SWITCH_VLAN':
      return {
        rowKey,
        actionType: 'SWITCH_VLAN',
        id,
        deviceId,
        port: '',
        targetVlanId: '',
        previousVlanId: '',
      }
  }
}
