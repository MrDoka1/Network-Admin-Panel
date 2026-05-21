import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authLogout } from './api/authClient'
import { EndpointInventoryView } from './components/endpoint/EndpointInventoryView'
import { NetworkGraphView } from './components/network/NetworkGraphView'
import { ReconfigurationTasksView } from './components/reconfig/ReconfigurationTasksView'
import { VlanMatrixView } from './components/vlan/VlanMatrixView'
import './App.css'

type Tab = 'topology' | 'vlans' | 'endpoints' | 'reconfigTasks'

function App() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('topology')
  const [logoutBusy, setLogoutBusy] = useState(false)

  async function handleLogout() {
    setLogoutBusy(true)
    try {
      await authLogout()
      navigate('/login', { replace: true })
    } finally {
      setLogoutBusy(false)
    }
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
          onClick={() => setTab('topology')}
        >
          Топология
        </button>
        <button
          type="button"
          className={
            tab === 'vlans'
              ? 'app-shell__tab app-shell__tab--active'
              : 'app-shell__tab'
          }
          onClick={() => setTab('vlans')}
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
          onClick={() => setTab('endpoints')}
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
          onClick={() => setTab('reconfigTasks')}
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
        {tab === 'vlans' ? <VlanMatrixView /> : null}
        {tab === 'endpoints' ? <EndpointInventoryView /> : null}
        {tab === 'reconfigTasks' ? <ReconfigurationTasksView /> : null}
      </main>
    </div>
  )
}

export default App
