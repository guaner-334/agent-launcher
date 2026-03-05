import React from 'react'
import { KanbanPage } from './components/KanbanPage'
import { TerminalWindow } from './components/TerminalWindow'

const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search)
  const windowType = params.get('window')
  const instanceId = params.get('instanceId')

  if (windowType === 'terminal' && instanceId) {
    return <TerminalWindow instanceId={instanceId} />
  }

  return <KanbanPage />
}

export default App
