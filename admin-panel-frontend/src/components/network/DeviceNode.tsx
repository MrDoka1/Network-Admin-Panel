import {
  Handle,
  Position,
  useNodeId,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Fragment, memo, useEffect, useMemo } from 'react'

export type PortEdge = 'top' | 'bottom' | 'left' | 'right'

export type DevicePortHandle = {
  id: string
  name: string
  adminStatus: 'UP' | 'DOWN'
  /** false — порт уже в линке, точка только для привязки линии */
  free: boolean
  /**
   * Сторона узла: при |Δy| ≥ |Δx| — верх/низ к пиру; иначе лево/право (пир с того же бока).
   * Без линка — по умолчанию снизу.
   */
  edge: PortEdge
  /** Кратко: access/trunk и VLAN (только физ. порты с L2 в модели) */
  vlanCaption?: string | null
  /** Доп. строка для title у handle/cap */
  vlanTooltip?: string | null
}

export type DeviceNodeData = Record<string, unknown> & {
  hostname: string
  deviceType: string
  mgmtIp: string
  status: string
  ports: DevicePortHandle[]
}

export type DeviceFlowNode = Node<DeviceNodeData, 'device'>

function typeLabel(t: string): string {
  if (t === 'ROUTER') return 'Маршрутизатор'
  if (t === 'SWITCH') return 'Коммутатор'
  return t
}

function portHoverTitle(p: DevicePortHandle): string {
  const base = `${p.name} (${p.adminStatus === 'UP' ? 'UP' : 'DOWN'})`
  return p.vlanTooltip ? `${base} · ${p.vlanTooltip}` : base
}

function PortNameBlock(props: {
  p: DevicePortHandle
  nameClass: string
  stackClass: string
}) {
  const { p, nameClass, stackClass } = props
  if (!p.vlanCaption) {
    return (
      <span className={nameClass} title={p.name}>
        {p.name}
      </span>
    )
  }
  return (
    <span className={stackClass}>
      <span className={nameClass} title={p.name}>
        {p.name}
      </span>
      <span className="device-node__port-vlan" title={p.vlanTooltip ?? p.vlanCaption}>
        {p.vlanCaption}
      </span>
    </span>
  )
}

/** Позиция вдоль верхнего/нижнего ребра (0..100 %). */
function edgeLeftPercent(index: number, total: number): number {
  if (total <= 0) return 50
  return ((index + 1) / (total + 1)) * 100
}

/** Позиция вдоль левого/правого ребра (0..100 %). */
function edgeTopPercent(index: number, total: number): number {
  if (total <= 0) return 50
  return ((index + 1) / (total + 1)) * 100
}

export const DeviceNode = memo(function DeviceNode({
  data,
  selected,
}: NodeProps<DeviceFlowNode>) {
  const nodeId = useNodeId()
  const updateInternals = useUpdateNodeInternals()
  const ports = data.ports

  const topPorts = useMemo(
    () =>
      ports
        .filter((p) => p.edge === 'top')
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [ports],
  )

  const bottomPorts = useMemo(
    () =>
      ports
        .filter((p) => p.edge === 'bottom')
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [ports],
  )

  const leftPorts = useMemo(
    () =>
      ports
        .filter((p) => p.edge === 'left')
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [ports],
  )

  const rightPorts = useMemo(
    () =>
      ports
        .filter((p) => p.edge === 'right')
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [ports],
  )

  useEffect(() => {
    if (nodeId) updateInternals(nodeId)
  }, [
    nodeId,
    updateInternals,
    ports,
    topPorts.length,
    bottomPorts.length,
    leftPorts.length,
    rightPorts.length,
  ])

  const typeClass =
    data.deviceType === 'ROUTER'
      ? 'device-node--router'
      : data.deviceType === 'SWITCH'
        ? 'device-node--switch'
        : ''

  return (
    <div
      className={`device-node ${typeClass}${selected ? ' device-node--selected' : ''}`.trim()}
    >
      {topPorts.length > 0 ? (
        <div className="device-node__strip device-node__strip--top">
          {topPorts.map((p, i) => {
            const x = edgeLeftPercent(i, topPorts.length)
            const connectable = p.free
            return (
              <Fragment key={p.id}>
                <Handle
                  type="source"
                  position={Position.Top}
                  id={p.id}
                  isConnectable={connectable}
                  className={`device-node__handle device-node__handle--top device-node__handle--${p.adminStatus.toLowerCase()}`}
                  style={{ left: `${x}%` }}
                  title={portHoverTitle(p)}
                />
                <div
                  className={`device-node__port-cap device-node__port-cap--top${p.free ? '' : ' device-node__port-cap--busy'}`}
                  style={{ left: `${x}%` }}
                  title={portHoverTitle(p)}
                >
                  <PortNameBlock
                    p={p}
                    nameClass="device-node__port-label device-node__port-label--vertical"
                    stackClass="device-node__port-label-stack device-node__port-label-stack--vertical"
                  />
                </div>
              </Fragment>
            )
          })}
        </div>
      ) : null}

      <div className="device-node__mid">
        {leftPorts.length > 0 ? (
          <div className="device-node__strip device-node__strip--left">
            {leftPorts.map((p, i) => {
              const y = edgeTopPercent(i, leftPorts.length)
              const connectable = p.free
              return (
                <Fragment key={p.id}>
                  <Handle
                    type="source"
                    position={Position.Left}
                    id={p.id}
                    isConnectable={connectable}
                    className={`device-node__handle device-node__handle--left device-node__handle--${p.adminStatus.toLowerCase()}`}
                    style={{ top: `${y}%` }}
                    title={portHoverTitle(p)}
                  />
                  <div
                    className={`device-node__port-cap device-node__port-cap--left${p.free ? '' : ' device-node__port-cap--busy'}`}
                    style={{ top: `${y}%` }}
                    title={portHoverTitle(p)}
                  >
                    <PortNameBlock
                      p={p}
                      nameClass="device-node__port-label device-node__port-label--side"
                      stackClass="device-node__port-label-stack device-node__port-label-stack--side"
                    />
                  </div>
                </Fragment>
              )
            })}
          </div>
        ) : null}

        <div className="device-node__head">
          <div className="device-node__type">{typeLabel(data.deviceType)}</div>
          <div className="device-node__hostname">{data.hostname}</div>
          <div className="device-node__meta">
            <span className="device-node__ip">{data.mgmtIp}</span>
            <span
              className={`device-node__status device-node__status--${data.status.toLowerCase()}`}
            >
              {data.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
            </span>
          </div>
        </div>

        {rightPorts.length > 0 ? (
          <div className="device-node__strip device-node__strip--right">
            {rightPorts.map((p, i) => {
              const y = edgeTopPercent(i, rightPorts.length)
              const connectable = p.free
              return (
                <Fragment key={p.id}>
                  <div
                    className={`device-node__port-cap device-node__port-cap--right${p.free ? '' : ' device-node__port-cap--busy'}`}
                    style={{ top: `${y}%` }}
                    title={portHoverTitle(p)}
                  >
                    <PortNameBlock
                      p={p}
                      nameClass="device-node__port-label device-node__port-label--side"
                      stackClass="device-node__port-label-stack device-node__port-label-stack--side"
                    />
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={p.id}
                    isConnectable={connectable}
                    className={`device-node__handle device-node__handle--right device-node__handle--${p.adminStatus.toLowerCase()}`}
                    style={{ top: `${y}%` }}
                    title={portHoverTitle(p)}
                  />
                </Fragment>
              )
            })}
          </div>
        ) : null}
      </div>

      {bottomPorts.length > 0 ? (
        <div className="device-node__strip device-node__strip--bottom">
          {bottomPorts.map((p, i) => {
            const x = edgeLeftPercent(i, bottomPorts.length)
            const connectable = p.free
            return (
              <Fragment key={p.id}>
                <div
                  className={`device-node__port-cap device-node__port-cap--bottom${p.free ? '' : ' device-node__port-cap--busy'}`}
                  style={{ left: `${x}%` }}
                  title={portHoverTitle(p)}
                >
                  <PortNameBlock
                    p={p}
                    nameClass="device-node__port-label device-node__port-label--vertical"
                    stackClass="device-node__port-label-stack device-node__port-label-stack--vertical"
                  />
                </div>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={p.id}
                  isConnectable={connectable}
                  className={`device-node__handle device-node__handle--bottom device-node__handle--${p.adminStatus.toLowerCase()}`}
                  style={{ left: `${x}%` }}
                  title={portHoverTitle(p)}
                />
              </Fragment>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
