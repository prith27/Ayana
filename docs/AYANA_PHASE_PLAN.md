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

## Phase 0 — Current State

### What exists today

- hardcoded persona selection
- hardcoded Tokyo/Japan destination flow
- hardcoded landmark progression
- hardcoded city and landmark overlay mappings
- working live voice connection infrastructure
- gesture layer integrated into the frontend
- sidebar and street-level exploration primitives

### Main limitation

The current frontend is a cinematic prototype, not yet a dynamic itinerary runtime.

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
   - `hide_sidebar`
   - `open_place_street_view`
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
