// Singleton control pattern — register React setters once from CameraWidget,
// then call these functions from anywhere (agent dispatch, card buttons, etc.)

import type { PlaceCategory } from '@/lib/places/nearbySearch'

export interface SidebarData {
  locationName: string
  locationSub: string
  tags: string[]
  sceneIndex: number
  sceneTotal: number
  lat: number
  lng: number
}

export type AgentState = 'connecting' | 'idle' | 'speaking' | 'disconnected'

type SetterFn<T> = (v: T) => void

let _setVisible:    SetterFn<boolean> | null = null
let _setData:       SetterFn<SidebarData | null> | null = null
let _setCategory:   SetterFn<PlaceCategory> | null = null
let _agentState: AgentState = 'idle'
const _agentStateSubscribers = new Set<SetterFn<AgentState>>()

export function registerSidebarSetters(opts: {
  setVisible:    SetterFn<boolean>
  setData:       SetterFn<SidebarData | null>
  setCategory:   SetterFn<PlaceCategory>
}): void {
  _setVisible    = opts.setVisible
  _setData       = opts.setData
  _setCategory   = opts.setCategory
}

export function subscribeAgentState(setAgentState: SetterFn<AgentState>): () => void {
  _agentStateSubscribers.add(setAgentState)
  setAgentState(_agentState)
  return () => {
    _agentStateSubscribers.delete(setAgentState)
  }
}

export function getAgentState(): AgentState {
  return _agentState
}

export function showSidebar(data: SidebarData): void {
  _setData?.(data)
  _setCategory?.('food')
  _setVisible?.(true)
}

export function showCategorySidebar(category: PlaceCategory, data: SidebarData): void {
  _setData?.(data)
  _setCategory?.(category)
  _setVisible?.(true)
}

export function hideSidebar(): void {
  _setVisible?.(false)
}

export function setAgentSpeaking(): void {
  _agentState = 'speaking'
  notifyAgentStateSubscribers()
}

export function setAgentConnecting(): void {
  _agentState = 'connecting'
  notifyAgentStateSubscribers()
}

export function setAgentIdle(): void {
  _agentState = 'idle'
  notifyAgentStateSubscribers()
}

export function setAgentDisconnected(): void {
  _agentState = 'disconnected'
  notifyAgentStateSubscribers()
}

function notifyAgentStateSubscribers(): void {
  _agentStateSubscribers.forEach((setAgentState) => {
    setAgentState(_agentState)
  })
}
