import {
  Handle,
  Position,
  useNodeId,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Fragment, memo, useEffect, useMemo, type CSSProperties } from 'react'
import type { DevicePortHandle } from './DeviceNode'

export type EndpointNodeData = Record<string, unknown> & {
  hostname: string
  status: string
  ports: DevicePortHandle[]
}

export type EndpointFlowNode = Node<EndpointNodeData, 'endpoint'>

function edgeLeftPercent(index: number, total: number): number {
  if (total <= 0) return 50
  return ((index + 1) / (total + 1)) * 100
}

function edgeTopPercent(index: number, total: number): number {
  if (total <= 0) return 50
  return ((index + 1) / (total + 1)) * 100
}

/**
 * Оконечное устройство на графе: NIC — target handles (ребро от порта коммутатора).
 */
export const EndpointNode = memo(function EndpointNode({
  data,
  selected,
}: NodeProps<EndpointFlowNode>) {
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

  const renderTargetHandle = (
    p: DevicePortHandle,
    position: Position,
    classSuffix: string,
    style: CSSProperties,
  ) => (
    <Handle
      type="target"
      position={position}
      id={p.id}
      isConnectable={false}
      className={`endpoint-node__handle endpoint-node__handle--${classSuffix} endpoint-node__handle--${p.adminStatus.toLowerCase()}`}
      style={style}
      title={`${p.name} (${p.adminStatus})`}
    />
  )

  return (
    <div
      className={`endpoint-node${selected ? ' endpoint-node--selected' : ''}`}
    >
      {topPorts.length > 0 ? (
        <div className="endpoint-node__strip endpoint-node__strip--top">
          {topPorts.map((p, i) => {
            const x = edgeLeftPercent(i, topPorts.length)
            return (
              <Fragment key={p.id}>
                {renderTargetHandle(p, Position.Top, 'top', { left: `${x}%` })}
                <div
                  className="endpoint-node__port-cap endpoint-node__port-cap--top"
                  style={{ left: `${x}%` }}
                  title={p.name}
                >
                  <span className="endpoint-node__port-label endpoint-node__port-label--vertical">
                    {p.name}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      ) : null}

      <div className="endpoint-node__mid">
        {leftPorts.length > 0 ? (
          <div className="endpoint-node__strip endpoint-node__strip--left">
            {leftPorts.map((p, i) => {
              const y = edgeTopPercent(i, leftPorts.length)
              return (
                <Fragment key={p.id}>
                  {renderTargetHandle(p, Position.Left, 'left', {
                    top: `${y}%`,
                  })}
                  <div
                    className="endpoint-node__port-cap endpoint-node__port-cap--left"
                    style={{ top: `${y}%` }}
                    title={p.name}
                  >
                    <span className="endpoint-node__port-label endpoint-node__port-label--side">
                      {p.name}
                    </span>
                  </div>
                </Fragment>
              )
            })}
          </div>
        ) : null}

        <div className="endpoint-node__head">
          <div className="endpoint-node__type">Оконечное устройство</div>
          <div className="endpoint-node__hostname">{data.hostname}</div>
          <div className="endpoint-node__meta">
            <span
              className={`endpoint-node__status endpoint-node__status--${data.status.toLowerCase()}`}
            >
              {data.status === 'ACTIVE' ? 'Активен' : 'Неактивен'}
            </span>
          </div>
        </div>

        {rightPorts.length > 0 ? (
          <div className="endpoint-node__strip endpoint-node__strip--right">
            {rightPorts.map((p, i) => {
              const y = edgeTopPercent(i, rightPorts.length)
              return (
                <Fragment key={p.id}>
                  <div
                    className="endpoint-node__port-cap endpoint-node__port-cap--right"
                    style={{ top: `${y}%` }}
                    title={p.name}
                  >
                    <span className="endpoint-node__port-label endpoint-node__port-label--side">
                      {p.name}
                    </span>
                  </div>
                  {renderTargetHandle(p, Position.Right, 'right', {
                    top: `${y}%`,
                  })}
                </Fragment>
              )
            })}
          </div>
        ) : null}
      </div>

      {bottomPorts.length > 0 ? (
        <div className="endpoint-node__strip endpoint-node__strip--bottom">
          {bottomPorts.map((p, i) => {
            const x = edgeLeftPercent(i, bottomPorts.length)
            return (
              <Fragment key={p.id}>
                <div
                  className="endpoint-node__port-cap endpoint-node__port-cap--bottom"
                  style={{ left: `${x}%` }}
                  title={p.name}
                >
                  <span className="endpoint-node__port-label endpoint-node__port-label--vertical">
                    {p.name}
                  </span>
                </div>
                {renderTargetHandle(p, Position.Bottom, 'bottom', {
                  left: `${x}%`,
                })}
              </Fragment>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})
