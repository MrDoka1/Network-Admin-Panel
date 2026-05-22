import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authLogout } from './api/authClient'
import { EndpointInventoryView } from './components/endpoint/EndpointInventoryView'
import {
  RouterInventoryView,
  SwitchInventoryView,
} from './components/network/NetworkDeviceInventoryView'
import { NetworkGraphView } from './components/network/NetworkGraphView'
import { ReconfigurationTasksView } from './components/reconfig/ReconfigurationTasksView'
import { VlanMatrixView } from './components/vlan/VlanMatrixView'
import { TAB_PATH, tabFromPathname, type AppTab } from './routes'
import './App.css'

function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tab = tabFromPathname(pathname)
  const [logoutBusy, setLogoutBusy] = useState(false)

  useEffect(() => {
    if (tab === null) {
      navigate('/', { replace: true })
    }
  }, [tab, navigate])

  function selectTab(next: AppTab) {
    const path = TAB_PATH[next]
    if (pathname !== path) {
      navigate(path)
    }
  }

  async function handleLogout() {
    setLogoutBusy(true)
    try {
      await authLogout()
      navigate('/login', { replace: true })
    } finally {
      setLogoutBusy(false)
    }
  }

  if (tab === null) {
    return null
  }

  return (
    <div className="app-shell">
      <nav className="app-shell__nav" aria-label="Разделы">
        <button
          type="button"
          className={
            tab === 'topology'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('topology')}
        >
          Топология
        </button>
        <button
          type="button"
          className={
            tab === 'routers'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('routers')}
        >
          Маршрутизаторы
        </button>
        <button
          type="button"
          className={
            tab === 'switches'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('switches')}
        >
          Коммутаторы
        </button>
        <button
          type="button"
          className={
            tab === 'vlans'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('vlans')}
        >
          VLAN
        </button>
        <button
          type="button"
          className={
            tab === 'endpoints'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('endpoints')}
        >
          Оконечные устройства
        </button>
        <button
          type="button"
          className={
            tab === 'reconfigTasks'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => selectTab('reconfigTasks')}
        >
          Реконфигурационные таски
        </button>
        <span className="app-shell__nav-spacer" aria-hidden="true" />
        <button
          type="button"
          className="app-shell__tab app-shell__tab--logout"
          onClick={() => void handleLogout()}
          disabled={logoutBusy}
        >
          {logoutBusy ? 'Выход…' : 'Выйти'}
        </button>
      </nav>
      <main className="app-shell__main">
        {tab === 'topology' ? <NetworkGraphView /> : null}
        {tab === 'routers' ? <RouterInventoryView /> : null}
        {tab === 'switches' ? <SwitchInventoryView /> : null}
        {tab === 'vlans' ? <VlanMatrixView /> : null}
        {tab === 'endpoints' ? <EndpointInventoryView /> : null}
        {tab === 'reconfigTasks' ? <ReconfigurationTasksView /> : null}
      </main>
    </div>
  )
}

export default App
