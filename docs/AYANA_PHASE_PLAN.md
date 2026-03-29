# Ayana — Phase-by-Phase Implementation Plan

This document defines the staged implementation plan for Ayana.

It is intended to keep the build simple, sequential, and testable. Each phase should establish stable primitives before the next layer is added.

The goal is to avoid mixing:

- frontend hardcoded prototype cleanup
- itinerary generation
- cinematic metadata generation
- runtime movement primitives
- voice orchestration

all at once.

---

## Guiding Principle

Ayana should be built in layers:

1. generated travel data
2. frontend prep overlays and selection flow
3. frontend runtime primitives
4. agent orchestration

The frontend should become a renderer/executor before the voice agent is allowed to orchestrate the experience.

---

## Implementation Status Snapshot

This section reflects the current implementation state of Ayana after the prep, runtime, and first orchestration slices were built.

### Completed work

- prep generation flow is implemented end to end
- the backend prep endpoint returns 3 generated itinerary options plus a stable `prep_id`
- the frontend renders the globe-centered loading state and generated itinerary overlay
- the live session can be enabled through the frontend env flag
- the live session now boots only after prep completes and the backend session is hydrated from `prep_id`
- the live agent is dynamically grounded on the exact generated itineraries and current session state
- `choose_itinerary` is implemented end to end over the live websocket
- `move_to_landmark` is implemented end to end over the live websocket
- `show_nearby` is implemented end to end over the live websocket
- screenshot-first and ACK-second ordering is implemented for visible movement tools
- the frontend runtime supports shared city and landmark executors that are reused by both manual widget actions and live-agent actions
- the frontend runtime now supports a shared nearby discovery executor that is reused by both manual widget actions and live-agent actions
- city movement uses runtime geocoding
- landmark movement uses runtime geocoding grounded by active city and country
- cinematic landmark arrival preserves overlay, settle timing, and slow orbit

### In-progress product area

- the orchestration story is partially implemented
- movement tools are done
- nearby discovery is done
- Street View entry (`open_place_street_view`) is done
- silence continuation is still pending
- full end-to-end orchestration validation is still pending

### Remaining work at the story level

- silence continuation layer
- end-to-end orchestration validation

### Deferred live tools

- explicit `hide_sidebar` (sidebar closes implicitly when entering Street View)

### Known stabilization gaps

- websocket disconnect handling should be hardened so disconnects do not surface as noisy server exceptions
- barge-in and interruption behavior still needs explicit validation against the static ADK reference
- reconnect and interruption lifecycle behavior should be stabilized before final orchestration validation

---

## Current App State

The current Ayana app behavior is:

1. user selects one of the hardcoded personas
2. frontend calls the backend prep endpoint
3. globe-centered loading state is shown while prep completes
4. if live mode is enabled, the websocket session is created only after prep returns and includes the backend-owned `prep_id`
5. the frontend sends a startup bootstrap text message instructing Ayana to greet the user and present the generated itinerary options
6. the itinerary overlay appears after a timed reveal delay following that startup bootstrap send
7. Ayana can call `choose_itinerary`
8. frontend executes the shared city activation flow, sends screenshot first, then sends `frontend_ack`
9. backend updates selected itinerary and current city only after ACK and injects grounded post-ACK follow-up text
10. Ayana can then call `move_to_landmark`
11. frontend executes the shared landmark activation flow, including overlay and slow orbit, then sends screenshot first and `frontend_ack` second
12. backend updates current landmark only after ACK and injects grounded post-ACK follow-up text
13. Ayana can then call `show_nearby(category)`
14. frontend executes the shared nearby discovery flow, waits for visible sidebar readiness and nearby results, then sends screenshot first and `frontend_ack` second
15. backend stores the latest nearby result set only after ACK and injects grounded follow-up text asking which option the user wants to explore next
16. Ayana can call `open_place_street_view(place_name)` with an exact nearby name; the frontend hides the sidebar, enters Street View, sends screenshot first, then `frontend_ack` (failed if there is no coverage)

### Current live-agent behavior

- Ayana has a fixed energetic travel-guide voice
- generated prep persona influences itinerary generation, not Ayana's speaking style
- accepted-phase movement narration is intentionally short:
  - one sentence maximum
  - no landmark facts or destination description before ACK
- accepted-phase nearby discovery narration is also intentionally short:
  - one sentence maximum
  - no specific place names before ACK
- accepted-phase Street View narration is intentionally short:
  - one sentence maximum
  - no street-level scene description before ACK
- post-ACK narration is where Ayana is allowed to describe the visible scene

### Current testing surface

- clickable itinerary overlay remains available as the testing path for city activation
- the runtime widget remains available for manual landmark testing
- manual nearby sidebar testing remains available
- live-agent movement and nearby discovery now share the same execution primitives as the manual testing paths

---

## Phase 0 — Current State

### What exists today

- hardcoded persona selection still exists as the prep trigger
- generated itinerary prep flow is implemented
- hardcoded Tokyo/Japan progression is no longer the main path for city and landmark activation
- dynamic city and landmark runtime movement primitives are implemented
- live voice connection infrastructure is working and grounded on prep-generated itineraries
- gesture layer is integrated into the frontend
- sidebar and street-level exploration primitives exist in the frontend
- nearby discovery is now agent-orchestrated
- Street View entry is now agent-orchestrated (`open_place_street_view`)

### Main limitation

The current app is no longer just a cinematic prototype, but the orchestration layer is still incomplete because discovery tools, silence continuation, and full validation are not finished.

---

## Phase 1 — Generated Prep Layer

### Goal

Replace hardcoded destination assumptions with generated itinerary options and a prep-first frontend flow, while keeping the live agent session disabled.

### Scope

- persona remains hardcoded
- after persona selection, backend runs a preparatory generation stage
- backend generates 3 itinerary options for the chosen persona
- frontend fetches and stores those itinerary options
- frontend shows a globe-centered loading state during prep
- frontend reveals 3 generated itinerary options as a clickable overlay
- frontend does not start the live session yet

### Backend responsibilities

- endpoint: persona -> 3 itinerary options
- all prompt logic and LLM calling lives in backend

### Frontend responsibilities

- trigger generation after persona selection
- receive and store itinerary options
- render the prep loading state over the globe
- render the generated itinerary selection overlay
- run in test mode with live session off

### Deliverables

- structured itinerary response shape
- frontend fetch flow after persona selection
- smooth loading-to-itinerary overlay transition
- env flag keeping live session disabled

### Exit criteria

- persona selection successfully produces 3 itinerary options
- the generated itinerary overlay renders and supports selection
- no live session is needed for this workflow

---

## Phase 2 — Runtime Primitive Layer

### Goal

Turn the frontend into a dynamic cinematic runtime that can move to generated places and render generated overlay content.

### Scope

- frontend uses runtime geocoding
- city name -> geocode -> transition
- landmark name -> geocode -> transition
- tool-call overlay payloads start replacing hardcoded overlay logic
- temporary manual handlers are added for testing

### Why this phase exists

Before agent orchestration, the core primitives must be proven:

- place resolution
- map movement
- overlay rendering
- dynamic scene content

### Frontend responsibilities

- add manual city input handler
- add manual landmark input handler
- geocode names at runtime
- execute the same cinematic transition system with dynamic destinations
- make `CityOverlay` and related experience UI consume tool-call payload data

### Deliverables

- city transition handler
- landmark transition handler
- dynamic overlay rendering driven by runtime payloads
- reduced dependence on `japan.ts`

### Exit criteria

- a generated city can be entered and transitioned to
- a generated landmark can be entered and transitioned to
- runtime overlay payloads are visibly driving overlays

---

## Phase 3 — Dynamic Scene Runtime

### Goal

Replace hardcoded scene progression with itinerary-driven scene state.

### Scope

- remove dependence on local fixed stop arrays as the main progression model
- introduce selected itinerary as the active runtime data source
- support dynamic scene transitions based on generated itinerary content

### Responsibilities

- frontend no longer thinks in `JAPAN_STOPS[idx]`
- frontend thinks in current itinerary and current scene
- scene transition logic uses generated place names plus runtime resolution

### Deliverables

- active selected itinerary state
- active scene state
- scene-to-scene progression using itinerary data

### Exit criteria

- experience no longer depends on hardcoded Tokyo/Japan scene progression
- chosen itinerary can drive the runtime flow

---

## Phase 4 — Agent Session Reactivation

### Goal

Turn the live Ayana session back on only after the itinerary and runtime primitives are stable.

### Scope

- env flag enables live session again
- Ayana starts only after the preparatory stage completes
- Ayana is grounded on the generated itinerary options
- Ayana introduces the 3 options verbally

### Responsibilities

- live session reads generated itinerary context
- frontend no longer uses the live session as the source of truth for primitives
- live session is layered on top of working primitives

### Exit criteria

- Ayana can start from generated data
- verbal introduction of the itinerary options works on top of a stable prep layer

---

## Phase 5 — Agent-Orchestrated Choice

### Goal

Allow the voice agent to interpret the user’s spoken itinerary choice and activate the selected itinerary.

### Scope

- user chooses only by voice
- the voice agent interprets the choice
- deterministic app code does not implement choice understanding logic

### Responsibilities

- agent handles speech understanding
- selected itinerary becomes the active experience package
- frontend executes that selected package

### Exit criteria

- user can choose an itinerary verbally
- selected itinerary activates without mouse or keyboard

---

## Phase 6 — Agent-Orchestrated Experience Flow

### Goal

Let Ayana guide the user through the chosen itinerary using the already-built runtime primitives.

### Scope

- proactive narration
- city-level movement
- landmark-level movement
- contextual overlays
- dynamic scene progression

### Responsibilities

- agent decides how to progress through the chosen itinerary
- frontend executes city and landmark transitions
- overlays and scene presentation stay grounded in tool-call payloads

### Exit criteria

- Ayana can guide the user through a full itinerary experience
- scene transitions are no longer hardcoded in frontend logic

---

## Phase 7 — Adaptive In-Session Interaction

### Goal

Support interruption and redirection while preserving continuity.

### Scope

- user interruptions
- focus shifts
- scene skipping
- deeper exploration
- gesture-based spatial control within the active experience

### Principle

The system should adapt without breaking the coherence of the journey.

### Exit criteria

- the user can redirect the experience without causing it to collapse into a generic chat flow

---

## Phase 8 — Final Itinerary Dashboard

### Goal

Conclude the cinematic session with a practical, editable trip plan.

### Scope

- timeline view
- journey map overview
- detailed stop summaries
- editable itinerary structure

### Exit criteria

- Ayana ends with an actionable itinerary output, not just an experience

---

## Immediate Next Phase

The next implementation phase is:

## Phase 4 / 5 / 6 Bridge — Agent Orchestration Layer

The prep and runtime primitive work is now substantially in place.

The next build step should focus on reconnecting the live agent on top of those primitives in the simplest possible way.

### Immediate tasks for the orchestration layer

1. define the first live tool families:
   - `choose_itinerary`
   - `move_to_landmark`
   - `show_nearby`
   - `open_place_street_view`
   - (explicit `hide_sidebar` deferred — implicit dismiss with Street View)
2. ground the live agent on generated itineraries plus current session state
3. add a thin deterministic director/state layer for gating and continuity
4. re-enable the live session only after prep is complete
5. add silence-based continuation nudges instead of a full second-brain model
6. connect tool calls to the already-built frontend execution handlers

---

## Summary

Ayana should not jump directly from hardcoded prototype to full orchestration without stable primitives.

The correct build order is:

1. generate itinerary data
2. build prep-first overlay flow
3. prove runtime primitives
4. reconnect the live agent with minimal tool contracts
5. add agent choice and movement orchestration
6. only add a richer second-brain pipeline if simple continuation proves insufficient

This phased plan is the reference for sequencing future Ayana implementation work.
