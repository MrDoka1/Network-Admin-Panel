import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export type TopologyEdgeData = {
  /** Индекс ребра среди линков между той же парой устройств (0 … count-1). */
  pathFanIndex?: number
  pathFanCount?: number
}

/**
 * SmoothStep. Подписи на линии не отображаются.
 *
 * Несколько линков между одной парой узлов: разные `stepPosition` у `getSmoothStepPath`,
 * чтобы изломы не совпадали (линии не рисуются одной кривой поверх другой).
 */
export function TopologyEdge(
  props: EdgeProps & { data?: TopologyEdgeData },
) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
  } = props

  const pathFanCount = data?.pathFanCount ?? 1
  const pathFanIndex = data?.pathFanIndex ?? 0

  /** Смещение излома вдоль «основной» оси smooth-step (см. xyflow getSmoothStepPath / stepPosition). */
  const stepPosition =
    pathFanCount <= 1
      ? 0.5
      : (() => {
          const spread = Math.min(
            0.12,
            0.44 / Math.max(1, pathFanCount - 1),
          )
          const raw =
            0.5 + (pathFanIndex - (pathFanCount - 1) / 2) * spread
          return Math.min(0.92, Math.max(0.08, raw))
        })()

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    stepPosition,
  })

  return (
    <BaseEdge
      {...props}
      path={path}
      label={undefined}
      labelShowBg={false}
    />
  )
}
