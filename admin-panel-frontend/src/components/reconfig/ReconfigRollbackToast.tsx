import { memo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { reconfigCreateTabPath } from '../../routes'
import './ReconfigRollbackToast.css'

type Props = {
  tabId: string
  onDismiss: () => void
}

export const ReconfigRollbackToast = memo(function ReconfigRollbackToast({
  tabId,
  onDismiss,
}: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 8000)
    return () => window.clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="reconfig-rollback-toast" role="status">
      <p className="reconfig-rollback-toast__text">
        Эта задача сохранена в новой вкладке. Проверьте её перед отправкой.{' '}
        <Link
          className="reconfig-rollback-toast__link"
          to={reconfigCreateTabPath(tabId)}
          onClick={onDismiss}
        >
          Открыть вкладку
        </Link>
      </p>
      <button
        type="button"
        className="reconfig-rollback-toast__close"
        aria-label="Закрыть"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
})
