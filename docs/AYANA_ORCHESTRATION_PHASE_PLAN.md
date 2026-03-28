# Ayana Orchestration Phase Plan

This document breaks the Ayana orchestration story into concrete implementation phases.

It assumes the frontend runtime primitives are already in place and the next step is to reconnect the live agent on top of them through ACK-gated tools over the existing websocket.

---

## Guiding Principle

This story should not be implemented as:

- all tools first
- then all frontend actions
- then all ACK handling

Instead, it should be built one tool at a time end to end.

For each tool, the full slice should be completed before moving to the next one:

1. tool schema
2. accepted semantic
3. frontend action payload
4. frontend ACK payload
5. post-ACK semantic follow-up
6. backend implementation
7. frontend execution wiring
8. manual validation

---

## Phase 0 — Transport And Session Backbone

### Goal

Establish the shared orchestration transport and state backbone before adding the first tool.

### Scope

- reuse the existing live ADK websocket as the only transport
- add explicit handling for:
  - `tool_result`
  - `frontend_action`
  - `frontend_ack`
- lock screenshot-first ordering for visually grounded tools:
  - frontend sends image first
  - frontend sends `frontend_ack` second
  - backend sends semantic continuation after the ACK
- define the backend session-director state model
- define shared tool result envelope helpers if needed

### Backend responsibilities

- normalize a single websocket message path for downstream frontend actions
- normalize a single websocket message path for upstream frontend acknowledgements
- lock the shared JSON envelopes for:
  - `tool_result`
  - `frontend_action`
  - `frontend_ack`
- define the minimal per-session orchestration state:
  - persona
  - generated itineraries
  - selected itinerary
  - current city
  - current landmark
  - latest nearby result set
  - sidebar open/closed if relevant
  - street-view open/closed if relevant

### Frontend responsibilities

- accept `frontend_action` messages on the existing live socket
- send `frontend_ack` messages on the same socket
- send screenshot/image messages before ACK for tools that require visual grounding
- keep agent text/image handling unchanged

### Exit criteria

- the websocket contract for downstream actions and upstream ACKs is locked
- the screenshot-before-ACK ordering is locked for visually descriptive tools
- the common JSON shapes for `tool_result`, `frontend_action`, and `frontend_ack` are locked
- session director state shape is defined
- no second transport path is introduced

---

## Phase 1 — `choose_itinerary` End-to-End

### Goal

Implement the full end-to-end orchestration slice for `choose_itinerary`.

### Scope

- define final tool schema
- define accepted semantic guidance
- define `ayana.choose_itinerary` frontend action payload
- define `frontend_ack` payload for successful or failed city activation
- define post-ACK semantic guidance

### Expected behavior

1. agent calls `choose_itinerary`
2. backend returns `accepted`
3. accepted semantic tells the agent to narrate the transition cinematically while waiting
4. backend sends `frontend_action`
5. frontend runs the existing city handler
6. frontend ACKs only after the visible city transition state is ready
7. frontend sends screenshot / visual grounding if needed
8. backend sends post-ACK semantic guidance telling the agent to describe the city and continue

### Why first

Everything else depends on a real selected itinerary and current city state.

### Exit criteria

- live agent can choose one generated itinerary
- frontend executes the existing city activation handler through a websocket action
- backend updates selected itinerary and current city state only after ACK

---

## Phase 2 — `move_to_landmark` End-to-End

### Goal

Implement the full end-to-end orchestration slice for `move_to_landmark`.

### Scope

- define final tool schema:
  - free-text `landmark_name`
  - `overlay_preset`
  - `tagline`
- define accepted semantic guidance
- define `ayana.move_to_landmark` frontend action payload
- define `frontend_ack` payload for landmark completion/failure
- define post-ACK semantic guidance

### Expected behavior

1. agent calls `move_to_landmark`
2. backend validates that an itinerary/city is active
3. backend returns `accepted`
4. accepted semantic tells the agent to narrate the movement while waiting
5. backend sends `frontend_action`
6. frontend runs the shared landmark handler
7. landmark transition completes with overlay plus slow orbit
8. frontend ACKs when the landmark scene is visibly ready
9. frontend sends screenshot / visual grounding if needed
10. backend sends post-ACK semantic guidance telling the agent to explain the landmark and optionally suggest nearby exploration

### Why second

This is the core movement continuation after city choice.

### Exit criteria

- landmark moves are agent-callable through the websocket action path
- free-text landmark input is grounded by the active city and country
- the same cinematic landmark flow used in the frontend primitives is preserved

---

## Phase 3 — `show_nearby` End-to-End

### Goal

Expose nearby discovery as an ACK-gated tool and return usable place candidates to the agent.

### Scope

- define final tool schema:
  - `category`
- define accepted semantic guidance
- define `ayana.show_nearby` frontend action payload
- define ACK payload shape including the compact nearby places list
- define post-ACK semantic guidance

### Expected behavior

1. agent calls `show_nearby(category)`
2. backend returns `accepted`
3. accepted semantic keeps the narration warm while the sidebar populates
4. backend sends `frontend_action`
5. frontend opens sidebar and fetches nearby places
6. frontend ACKs only when sidebar is visibly ready and nearby places are known
7. ACK includes the compact nearby result set
8. backend stores that result set in session state
9. backend sends post-ACK semantic guidance letting the agent discuss the returned places

### Why third

This creates the discovery context needed for Street View.

### Exit criteria

- agent can open food / shopping / activities discovery
- agent receives compact nearby place names it can reference
- session state stores the current nearby result set

---

## Phase 4 — `hide_sidebar` End-to-End

### Goal

Allow the agent to close nearby discovery cleanly.

### Scope

- define final empty tool schema
- define accepted semantic guidance
- define `ayana.hide_sidebar` frontend action payload
- define simple ACK payload
- define post-ACK semantic guidance

### Expected behavior

1. agent calls `hide_sidebar`
2. backend returns `accepted`
3. backend sends `frontend_action`
4. frontend hides sidebar
5. frontend ACKs success or failure
6. backend updates sidebar state and sends follow-up semantic guidance only if appropriate

### Why fourth

This is simple, but completes the discovery control loop.

### Exit criteria

- sidebar open/closed state can be agent-controlled
- backend state stays aligned with visible sidebar state

---

## Phase 5 — `open_place_street_view` End-to-End

### Goal

Let the agent open Street View for one of the currently discovered nearby places.

### Scope

- define final tool schema:
  - `place_name`
- define accepted semantic guidance
- define `ayana.open_place_street_view` frontend action payload
- define ACK payload for success/failure
- define post-ACK semantic guidance

### Expected behavior

1. agent calls `open_place_street_view(place_name)`
2. backend validates that `place_name` exists in the latest nearby result set
3. backend returns `accepted`
4. accepted semantic narrates entry into the immersive view
5. backend sends `frontend_action`
6. frontend runs the existing Street View path for that place
7. frontend ACKs when Street View is visibly open or reports failure
8. frontend sends screenshot / visual grounding if needed
9. backend sends post-ACK semantic guidance allowing the agent to react to the immersive view

### Why fifth

This depends on nearby discovery being implemented and stored in session state.

### Exit criteria

- agent can open Street View for a place returned by `show_nearby`
- backend validates place selection against current nearby context
- street-view state is reflected in session state if needed

---

## Phase 6 — Silence Continuation Layer

### Goal

Add the lightweight continuation behavior without introducing a second-brain model.

### Scope

- detect approximately 2 seconds of post-turn silence
- send a grounded continuation prompt back into the live session
- avoid interrupting active tool execution waits or user speech

### Recommended continuation style

- `Continue guiding the user through the selected itinerary from the current scene.`

### Important rules

- continuation is not a tool
- continuation should not fire while awaiting a frontend ACK for an in-flight visible action
- continuation should use current session state for grounding

### Exit criteria

- the agent can continue naturally after brief silence
- continuation does not race with tool execution or visible state confirmation

---

## Phase 7 — End-to-End Orchestration Validation

### Goal

Verify that the live agent, tool loop, frontend action execution, ACK flow, and post-ACK semantics all work together.

### Scenarios to validate

1. itinerary selection
2. landmark movement
3. nearby discovery
4. sidebar hide
5. street-view opening
6. silence continuation after normal narration
7. failure handling for geocoding or frontend application failure

### Validation focus

- correct websocket message ordering
- correct `job_id` correlation
- agent never speaks ahead of visible state
- screenshots / visual grounding arrive after visible completion
- state gating prevents invalid tool calls

### Exit criteria

- the full live orchestration loop works on top of the runtime primitives
- the agent reasons from ACKed visible state instead of backend intent

---

## Recommended Build Order

Implement in this exact order:

1. transport + session backbone
2. `choose_itinerary`
3. `move_to_landmark`
4. `show_nearby`
5. `hide_sidebar`
6. `open_place_street_view`
7. silence continuation
8. end-to-end validation

---

## Summary

This story should be built as a sequence of thin, reliable orchestration slices.

The frontend primitives already exist.

The work now is to let the live agent drive them safely through:

- one websocket
- one ACK-gated tool lifecycle
- one thin director/state layer
- one tool completed end to end at a time
