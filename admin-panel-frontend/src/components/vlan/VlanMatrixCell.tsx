import { memo } from 'react'

export type VlanMatrixPending = {
  deviceId: string
  vlanId: number
  willAdd: boolean
}

type Props = {
  deviceId: string
  vlanId: number
  hostname: string
  present: boolean
  vlanProtected: boolean
  pending: VlanMatrixPending | null
  toggling: boolean
  onActivate: (deviceId: string, vlanId: number, present: boolean) => void
}

export const VlanMatrixCell = memo(function VlanMatrixCell({
  deviceId,
  vlanId,
  hostname,
  present,
  vlanProtected,
  pending,
  toggling,
  onActivate,
}: Props) {
  const isPending =
    pending?.deviceId === deviceId && pending?.vlanId === vlanId
  const willAdd = isPending ? pending.willAdd : !present

  let stateClass: string
  if (toggling && isPending) {
    stateClass = 'vlan-matrix__cell-btn--busy'
  } else if (isPending) {
    stateClass = willAdd
      ? 'vlan-matrix__cell-btn--pending-add'
      : 'vlan-matrix__cell-btn--pending-remove'
  } else if (present) {
    stateClass = 'vlan-matrix__cell-btn--present'
  } else {
    stateClass = 'vlan-matrix__cell-btn--absent'
  }

  const label =
    toggling && isPending
      ? '…'
      : isPending
        ? willAdd
          ? 'Добавить?'
          : 'Удалить?'
        : ''

  const title = isPending
    ? willAdd
      ? `Подтвердите: настроить VLAN ${vlanId} на ${hostname}`
      : `Подтвердите: убрать VLAN ${vlanId} с ${hostname}`
    : present
      ? `VLAN ${vlanId} настроен на ${hostname}. Нажмите для изменения`
      : `VLAN ${vlanId} не настроен на ${hostname}. Нажмите для изменения`

  return (
    <td
      className={
        vlanProtected
          ? 'vlan-matrix__cell vlan-matrix__cell--protected-col'
          : 'vlan-matrix__cell'
      }
    >
      <button
        type="button"
        className={`vlan-matrix__cell-btn ${stateClass}${
          vlanProtected ? ' vlan-matrix__cell-btn--protected-col' : ''
        }`}
        title={title}
        aria-label={
          isPending
            ? willAdd
              ? `Подтвердить добавление VLAN ${vlanId}`
              : `Подтвердить удаление VLAN ${vlanId}`
            : present
              ? `VLAN ${vlanId}: есть`
              : `VLAN ${vlanId}: нет`
        }
        disabled={toggling && isPending}
        onClick={() => onActivate(deviceId, vlanId, present)}
      >
        {label}
      </button>
    </td>
  )
})
