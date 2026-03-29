// Singleton control pattern — register React setters once from CameraWidget,
// then call these functions from anywhere (agent dispatch, card buttons, etc.)

import type { NearbyPlace, PlaceCategory } from '@/lib/places/nearbySearch'

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
let _setRequestId:  SetterFn<number> | null = null
let _agentState: AgentState = 'idle'
const _agentStateSubscribers = new Set<SetterFn<AgentState>>()
let _nextSidebarRequestId = 0
let _pendingSidebarRequest: {
  requestId: number
  resolve: (value: SidebarReadyResult) => void
  reject: (reason?: unknown) => void
} | null = null
let _latestNearbyResult: SidebarReadyResult | null = null

export interface SidebarReadyResult {
  requestId: number
  category: PlaceCategory
  data: SidebarData
  places: NearbyPlace[]
}

export function registerSidebarSetters(opts: {
  setVisible:    SetterFn<boolean>
  setData:       SetterFn<SidebarData | null>
  setCategory:   SetterFn<PlaceCategory>
  setRequestId?: SetterFn<number>
}): void {
  _setVisible    = opts.setVisible
  _setData       = opts.setData
  _setCategory   = opts.setCategory
  _setRequestId  = opts.setRequestId ?? null
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
  showCategorySidebar('food', data)
}

export function showCategorySidebar(category: PlaceCategory, data: SidebarData): number {
  const requestId = ++_nextSidebarRequestId
  _setData?.(data)
  _setCategory?.(category)
  _setRequestId?.(requestId)
  _setVisible?.(true)
  return requestId
}

export function openCategorySidebar(
  category: PlaceCategory,
  data: SidebarData
): Promise<SidebarReadyResult> {
  if (_pendingSidebarRequest) {
    _pendingSidebarRequest.reject(
      new Error('Superseded by a newer sidebar request.')
    )
    _pendingSidebarRequest = null
  }

  const requestId = showCategorySidebar(category, data)
  return new Promise<SidebarReadyResult>((resolve, reject) => {
    _pendingSidebarRequest = {
      requestId,
      resolve,
      reject,
    }
  })
}

export function hideSidebar(): void {
  _setVisible?.(false)
  _setRequestId?.(0)
  if (_pendingSidebarRequest) {
    _pendingSidebarRequest.reject(
      new Error('Sidebar was closed before nearby results were ready.')
    )
    _pendingSidebarRequest = null
  }
}

export function reportSidebarResults(result: SidebarReadyResult): void {
  _latestNearbyResult = {
    ...result,
    data: { ...result.data },
    places: result.places.map((place) => ({ ...place })),
  }
  if (_pendingSidebarRequest?.requestId === result.requestId) {
    _pendingSidebarRequest.resolve(_latestNearbyResult)
    _pendingSidebarRequest = null
  }
}

export function reportSidebarError(
  requestId: number,
  errorMessage: string
): void {
  if (_pendingSidebarRequest?.requestId === requestId) {
    _pendingSidebarRequest.reject(new Error(errorMessage))
    _pendingSidebarRequest = null
  }
}

export function getLatestNearbyResult(): SidebarReadyResult | null {
  if (!_latestNearbyResult) {
    return null
  }
  return {
    ..._latestNearbyResult,
    data: { ..._latestNearbyResult.data },
    places: _latestNearbyResult.places.map((place) => ({ ...place })),
  }
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
