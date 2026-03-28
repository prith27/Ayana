'use client'

import { useState, useEffect } from 'react'
import { getAgentState, subscribeAgentState, type AgentState } from '@/lib/maps/sidebarControls'

export function useAgentState(): AgentState {
  const [state, setState] = useState<AgentState>(getAgentState)
  useEffect(() => subscribeAgentState(setState), [])
  return state
}
