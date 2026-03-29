import type { OverlayPreset } from '@/lib/ayana/runtime'

export type ToolStatus = 'accepted' | 'completed' | 'failed'
export type FrontendAckStatus = 'applied' | 'failed'

export type FrontendActionType =
  | 'ayana.choose_itinerary'
  | 'ayana.move_to_landmark'
  | 'ayana.show_nearby'
  | 'ayana.open_place_street_view'
  | 'ayana.end_session'

export interface ToolResult {
  status: ToolStatus
  tool: string
  job: {
    id: string
  }
  summary: string
  payload?: Record<string, unknown>
  frontend_action?: FrontendAction
}

export interface ToolResultMessage {
  type: 'tool_result'
  result: ToolResult
}

export interface FrontendAction {
  action_type: FrontendActionType | string
  source_tool: string
  job_id: string
  payload: Record<string, unknown>
}

export interface ChooseItineraryActionPayload extends Record<string, unknown> {
  itinerary_id: string
  city_name: string
  country_name: string
  overlay_preset: OverlayPreset
  tagline: string
}

export interface MoveToLandmarkActionPayload extends Record<string, unknown> {
  itinerary_id: string
  city_name: string
  country_name: string
  landmark_name: string
  overlay_preset: OverlayPreset
  tagline: string
}

export interface ShowNearbyActionPayload extends Record<string, unknown> {
  category: 'food' | 'shopping' | 'activities'
  city_name?: string
  country_name?: string
  landmark_name?: string
}

export interface OpenPlaceStreetViewActionPayload extends Record<string, unknown> {
  place_name: string
}

export type EndSessionActionPayload = Record<string, never>

/** Fields sent on successful `ayana.open_place_street_view` frontend_ack.payload */
export interface OpenPlaceStreetViewAckPayload extends Record<string, unknown> {
  category: string
  location_name: string
  location_sub: string
  place_name: string
  address: string | null
  rating: number | null
  user_rating_count: number | null
  types: string[]
  lat: number
  lng: number
}

export interface NearbyPlaceAckPayload extends Record<string, unknown> {
  name: string
  rating: number | null
  user_rating_count: number | null
  types: string[]
  address: string | null
  lat: number
  lng: number
}

export interface FrontendActionMessage {
  type: 'frontend_action'
  action: FrontendAction
}

export interface FrontendAck {
  status: FrontendAckStatus
  action_type: FrontendActionType | string
  source_tool: string
  job_id: string
  summary: string
  payload?: Record<string, unknown>
}

export interface FrontendAckMessage {
  type: 'frontend_ack'
  ack: FrontendAck
}

export function isToolResultMessage(value: unknown): value is ToolResultMessage {
  if (!isObject(value) || value.type !== 'tool_result') {
    return false
  }

  const result = value.result
  return (
    isObject(result) &&
    typeof result.status === 'string' &&
    typeof result.tool === 'string' &&
    isObject(result.job) &&
    typeof result.job.id === 'string' &&
    typeof result.summary === 'string'
  )
}

export function isFrontendActionMessage(
  value: unknown
): value is FrontendActionMessage {
  if (!isObject(value) || value.type !== 'frontend_action') {
    return false
  }

  const action = value.action
  return (
    isObject(action) &&
    typeof action.action_type === 'string' &&
    typeof action.source_tool === 'string' &&
    typeof action.job_id === 'string' &&
    isObject(action.payload)
  )
}

export function buildFrontendAckMessage(
  ack: FrontendAck
): FrontendAckMessage {
  return {
    type: 'frontend_ack',
    ack,
  }
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
