export type AppTab =
  | 'topology'
  | 'routers'
  | 'switches'
  | 'vlans'
  | 'endpoints'
  | 'reconfigTasks'

export const TAB_PATH: Record<AppTab, string> = {
  topology: '/',
  routers: '/routers',
  switches: '/switches',
  vlans: '/vlans',
  endpoints: '/endpoints',
  reconfigTasks: '/reconfig-tasks',
}

export const RECONFIG_TASKS_CREATE_PATH = '/reconfig-tasks/new'

const PATH_TAB = new Map<string, AppTab>(
  (Object.entries(TAB_PATH) as [AppTab, string][]).map(([tab, path]) => [path, tab]),
)

export function tabFromPathname(pathname: string): AppTab | null {
  const exact = PATH_TAB.get(pathname)
  if (exact) return exact
  if (pathname.startsWith(`${TAB_PATH.reconfigTasks}/`)) {
    return 'reconfigTasks'
  }
  return null
}

export type ReconfigSection = 'list' | 'create'

export function reconfigSectionFromPathname(pathname: string): ReconfigSection | null {
  if (pathname === TAB_PATH.reconfigTasks) return 'list'
  if (pathname === RECONFIG_TASKS_CREATE_PATH) return 'create'
  return null
}

export function reconfigSectionPath(section: ReconfigSection): string {
  return section === 'list' ? TAB_PATH.reconfigTasks : RECONFIG_TASKS_CREATE_PATH
}
