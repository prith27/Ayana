# Ayana Orchestration Story

This document locks the next implementation phase after Ayana's frontend runtime primitives.

It defines the high-level orchestration model, the first tool families, and the simple continuation strategy for the live agent.

---

## Purpose

The primitives phase established:

- generated itineraries
- runtime city movement
- runtime landmark movement
- overlay payload handling
- nearby discovery and street-view frontend primitives

The purpose of this phase is to let the live agent orchestrate those primitives without turning the frontend into a second reasoning system.

This phase is about:

- tool contracts for the live agent
- grounding the live agent on generated itineraries and current session state
- simple silence-based continuation
- exposing existing frontend execution paths as agent-driven actions

This phase is not about:

- building a separate high-fidelity reasoning pipeline first
- replacing the live agent with a second orchestration LLM
- solving final adaptive redirection or interruption logic

---

## Current Implementation Status

The orchestration story is now partially implemented.

### Completed slices

- websocket transport and ACK-gated message shapes are implemented on the existing live ADK socket
- backend session-director state exists and tracks:
  - persona
  - generated itineraries
  - selected itinerary
  - current city
  - current landmark
  - nearby places
  - sidebar visibility
  - street-view visibility
  - current Street View place (after a successful Street View ACK)
- startup grounding now happens from backend-owned prep state via `prep_id`
- the live agent is grounded on exact generated itineraries and current session state
- `choose_itinerary` is fully implemented end to end
- `move_to_landmark` is fully implemented end to end
- `show_nearby` is fully implemented end to end
- `open_place_street_view` is fully implemented end to end
- screenshot-first then ACK-second ordering is implemented for visible movement tools
- post-ACK semantic follow-up is implemented for movement tools

### Remaining slices

- silence continuation nudge layer
- full end-to-end orchestration validation

### Deferred live tools

- explicit `hide_sidebar` — nearby sidebar is closed implicitly when entering Street View (and similar UX), not via a separate agent tool

### Current app behavior

At the current build state:

1. prep completes before the live session is created
2. websocket connection includes `prep_id`
3. backend hydrates session grounding before the live run starts
4. frontend sends a startup bootstrap message telling Ayana to greet and present only the generated itinerary options
5. itinerary overlay reveal is delayed after the startup send to give Ayana time to begin the greeting beat
6. after city selection, Ayana can drive city movement through `choose_itinerary`
7. after city arrival ACK, Ayana can drive landmark movement through `move_to_landmark`
8. after landmark arrival ACK, Ayana can drive nearby discovery through `show_nearby(category)`
9. nearby discovery returns grounded visible options through screenshot-first and ACK-second ordering
10. after nearby ACK, Ayana can open Street View for an exact listed `place_name` via `open_place_street_view`; failures (e.g. no coverage) return a failed `frontend_ack`

### Current accepted-phase speech rule

For the implemented movement tools, the accepted-phase speech is now locked to:

- one short sentence maximum
- no facts or visual description yet
- no pretending arrival is already complete

The real grounded explanation starts only after frontend ACK confirms the visible state.

### Known implementation gaps

- websocket disconnect handling still needs hardening
- barge-in and interruption behavior should be validated and tightened against the static ADK reference

---

## Locked Orchestration Take

The orchestration model should stay simple for now.

- the live agent remains the primary reasoning and speaking system
- the frontend remains a renderer and executor
- the backend adds only a thin deterministic director/state layer
- silence handling can use a simple continuation nudge instead of a second-brain model

### What "thin director" means

This layer should primarily track:

- persona
- generated itineraries
- selected itinerary
- current city
- current landmark
- visited landmarks if needed
- whether sidebar or street view is open if relevant

It should gate tool availability and decide what lightweight continuation prompt to send after silence.

It should not become a second autonomous travel planner at this stage.

---

## Locked Async Tool Model

Ayana should use the same high-level two-way async pattern as ThinkSpace, but in a lighter form.

The key principle is:

- backend tool acceptance is not the same thing as visible frontend completion
- the agent should not speak as if a scene change is complete until the frontend confirms it

### The four truths

There are four distinct events in the Ayana tool lifecycle:

1. tool accepted by backend
2. deterministic frontend action sent
3. frontend acknowledgement received
4. semantic follow-up injected back into the live agent loop

These must stay separate.

### Locked flow

For Ayana tools, the lifecycle should be:

1. agent calls tool
2. backend returns `accepted`
3. accepted result includes semantic guidance telling the agent to narrate the transition while waiting
4. backend sends a dedicated `frontend_action`
5. frontend executes the requested visible action
6. frontend sends screenshot / visual grounding first if the tool requires it
7. frontend then sends `frontend_ack`
8. backend injects post-ACK semantic content telling the agent the action is complete, and to reason from the image it just received when relevant

### Accepted semantic meaning

The accepted result should tell the agent:

- the requested action has started
- the visible transition is not complete yet
- it should keep the user engaged briefly while waiting
- it should stay extremely short for movement tools

Examples:

- `We are heading into Tokyo now.`
- `Let us step into Fushimi Inari.`

### Current locked wording take

For `choose_itinerary` and `move_to_landmark`, the accepted phase should be:

- one sentence maximum
- transition-only
- no facts, history, recommendations, or visual description before ACK

### ACK semantic meaning

The ACK-triggered follow-up should tell the agent:

- the visible action is now complete
- if an image was just sent, it should refer to that image as the current visual grounding
- it is safe to describe what the user is seeing
- it should continue with the correct next-step behavior for that tool

Examples:

- after `choose_itinerary`: describe the city and continue the journey
- after `move_to_landmark`: explain the landmark and suggest nearby categories
- after `show_nearby`: describe the shown options and guide the user toward one
- after `open_place_street_view`: react to the immersive view

### Important rule

For Ayana, `frontend_ack` should mean the state is visibly ready, not merely that a handler started running.

For movement tools especially, the ACK should happen only after the meaningful visible transition state is reached.

When a tool uses screenshot grounding, the ordering should be:

1. visible state becomes ready
2. frontend sends image
3. frontend sends `frontend_ack`
4. backend sends semantic follow-up that may explicitly tell the agent to refer to that image

---

## Transport Model

Ayana should use the existing live ADK websocket as the only transport path.

Do not add a separate REST path or a second socket for frontend execution.

### Why

- one session
- one ordering stream
- one `job_id` correlation path
- lower risk of race conditions

### Locked websocket message shape

The same live websocket should carry:

#### Downstream messages

- normal agent events
- `tool_result`
- `frontend_action`

#### Upstream messages

- existing `text`
- existing `image`
- `frontend_ack`

### Meaning of each

#### `tool_result`

This is backend lifecycle truth:

- `accepted`
- `completed`
- `failed`

#### `frontend_action`

This is the exact UI execution instruction the frontend should apply.

Examples:

- `ayana.choose_itinerary`
- `ayana.move_to_landmark`
- `ayana.show_nearby`
- `ayana.open_place_street_view`

#### `frontend_ack`

This is frontend visible-state truth.

It should report:

- whether the action applied or failed
- which action it corresponds to
- the shared `job_id`
- a short summary of the concrete result

It may also carry semantic guidance metadata telling the backend what kind of grounded continuation to inject next.

---

## Locked Common JSON Shapes

Phase 0 should lock the common transport envelopes now, while leaving tool-specific semantic wording to each later tool phase.

### `tool_result`

This is the backend lifecycle envelope.

```json
{
  "type": "tool_result",
  "result": {
    "status": "accepted",
    "tool": "ayana.choose_itinerary",
    "job": {
      "id": "job_123"
    },
    "summary": "Started itinerary transition. Keep narrating the move until visual confirmation arrives.",
    "payload": {
      "itinerary_id": "kyoto_romantic_01"
    }
  }
}
```

### Required fields

- `type`
- `result.status`
- `result.tool`
- `result.job.id`
- `result.summary`

### Notes

- `status` is one of:
  - `accepted`
  - `completed`
  - `failed`
- `summary` is the semantic guidance text for the live agent
- `payload` is optional tool-specific metadata

### `frontend_action`

This is the deterministic frontend execution instruction.

```json
{
  "type": "frontend_action",
  "action": {
    "action_type": "ayana.choose_itinerary",
    "source_tool": "ayana.choose_itinerary",
    "job_id": "job_123",
    "payload": {
      "itinerary_id": "kyoto_romantic_01",
      "overlay_preset": "heritage",
      "tagline": "A city of lantern light and slow ritual"
    }
  }
}
```

### Required fields

- `type`
- `action.action_type`
- `action.source_tool`
- `action.job_id`
- `action.payload`

### Notes

- `payload` contains execution data only
- it should not contain narration or vague orchestration intent

### `frontend_ack`

This is the frontend visible-state confirmation.

```json
{
  "type": "frontend_ack",
  "ack": {
    "status": "applied",
    "action_type": "ayana.choose_itinerary",
    "source_tool": "ayana.choose_itinerary",
    "job_id": "job_123",
    "summary": "City transition completed and Tokyo is now visible.",
    "payload": {
      "city_name": "Tokyo",
      "country_name": "Japan"
    }
  }
}
```

### Required fields

- `type`
- `ack.status`
- `ack.action_type`
- `ack.source_tool`
- `ack.job_id`
- `ack.summary`

### Notes

- `status` is one of:
  - `applied`
  - `failed`
- `summary` describes what is now visibly true
- `payload` is optional and should include only useful structured result data

### Example `frontend_ack` for `show_nearby`

For nearby discovery, the ACK should return grounded nearby place data the agent can use next.

```json
{
  "type": "frontend_ack",
  "ack": {
    "status": "applied",
    "action_type": "ayana.show_nearby",
    "source_tool": "ayana.show_nearby",
    "job_id": "job_456",
    "summary": "Food sidebar opened with 3 nearby places.",
    "payload": {
      "category": "food",
      "places": [
        {
          "name": "Kyoto Gogyo",
          "types": ["ramen", "restaurant"],
          "rating": 4.3,
          "user_rating_count": 1821,
          "address": "700 Shimogyo-ku, Kyoto",
          "lat": 35.0037,
          "lng": 135.7683
        },
        {
          "name": "Nishiki Market",
          "types": ["market", "food"],
          "rating": 4.5,
          "user_rating_count": 9412,
          "address": "609 Nishidaimonjicho, Kyoto",
          "lat": 35.005,
          "lng": 135.7648
        }
      ]
    }
  }
}
```

### Screenshot rule

For tools that need visual grounding:

1. frontend sends `image`
2. frontend sends `frontend_ack`
3. backend sends grounded semantic follow-up

The image and ACK must correlate to the same `job_id`.

This screenshot-first ordering should be used for:

- `choose_itinerary`
- `move_to_landmark`
- `show_nearby`
- `open_place_street_view`

---

## Tool Families

The first orchestration surface should be small and grouped into three families.

### 1. Movement tools

- `choose_itinerary`
- `move_to_landmark`

These are the core scene-transition tools.

### 2. Discovery tools

- `show_nearby`

This exposes the existing sidebar-based nearby place exploration. The sidebar may be dismissed implicitly (for example when entering Street View) without a dedicated `hide_sidebar` tool on the live surface.

### 3. Immersion tools

- `open_place_street_view`

This exposes the existing street-view entry path for a discovered nearby place.

---

## Locked First Tool Surface

### `choose_itinerary`

Recommended shape:

```json
{
  "itinerary_id": "kyoto_romantic_01",
  "overlay_preset": "heritage",
  "tagline": "A city of lantern light and slow ritual"
}
```

### Rules

- `itinerary_id` must come from the generated itinerary set
- the frontend resolves city and country from the selected itinerary object
- the tool carries the overlay payload needed by the frontend runtime

### `move_to_landmark`

Recommended shape:

```json
{
  "landmark_name": "Fushimi Inari Shrine",
  "overlay_preset": "heritage",
  "tagline": "Ten thousand gates, one path inward"
}
```

### Rules

- `landmark_name` is free text
- the active city and country provide the grounding context
- the frontend/runtime builds the geocoding query as:
  - `landmark_name + city_name + country_name`
- off-itinerary landmarks are allowed within the active city context

### `show_nearby`

Recommended shape:

```json
{
  "category": "food"
}
```

Allowed categories:

- `food`
- `shopping`
- `activities`

This should open the existing nearby sidebar and return the visible nearby place list back to the agent.

The returned nearby place payload should include grounded details such as:

- `name`
- `rating`
- `user_rating_count`
- `types`
- `address`
- `lat`
- `lng`

### `open_place_street_view`

Recommended shape:

```json
{
  "place_name": "Kyoto Gogyo"
}
```

### Rules

- `place_name` must exactly match (trim + case-insensitive) a name from the session `nearby_places` set populated by the last successful `show_nearby` ACK
- the tool should not require the agent to send coordinates
- the frontend/runtime resolves coordinates from cached nearby results and uses the existing `flyToPlaceStreetView` path; no Street View coverage surfaces as a failed ACK

---

## Why `show_nearby` Should Be Generic

We do not need separate tools for:

- `show_food`
- `show_shopping`
- `show_activities`

One generic tool is simpler:

- `show_nearby(category)`

This keeps the tool surface small while preserving the same frontend behavior.

---

## Continuation Strategy

The continuation strategy should be simple in v1.

After approximately 2 seconds of silence following an agent turn, the system should send a lightweight text nudge back into the live session.

### Example style

- `Continue guiding the user through the selected itinerary from the current scene.`

This is preferred over a bare:

- `Continue with the itinerary.`

because it keeps the nudge slightly grounded without adding a second reasoning model.

### Locked principle

- continuation is not a tool
- continuation is a text nudge into the live agent session
- the live agent then decides whether to narrate or call a tool

---

## Grounding Model

The live agent should be grounded on two types of context:

### 1. Static prep context

- persona
- generated itinerary options
- city facts
- landmark lists
- landmark facts and facets

### 2. Runtime session context

- whether an itinerary has been selected
- the current city
- the current landmark
- the current nearby places result set if sidebar tools were used
- whether the user is currently in a discovery subflow

The live agent should not be forced to infer this from raw frontend state dumps.

The backend director/state layer should structure it clearly.

---

## Frontend Responsibility

The frontend should remain the execution layer.

It should own:

- city and landmark runtime handlers
- sidebar rendering and hiding
- nearby place rendering
- street-view entry
- camera and overlay choreography

It should not own:

- deciding what comes next
- interpreting spoken itinerary choice
- deciding when to call discovery tools

---

## Backend Responsibility

The backend live-agent layer should own:

- tool definitions
- session grounding
- state gating
- silence-based continuation nudges
- deciding which tools are currently available

### Example gating

Before itinerary selection:

- `choose_itinerary` allowed
- `move_to_landmark` not allowed yet
- sidebar/street-view discovery tools not useful yet

After itinerary selection:

- `move_to_landmark` allowed
- `show_nearby` allowed
- `open_place_street_view` allowed after discovery has returned places (names must match stored nearby results)

---

## Tool Return Shape Take

Tool returns should stay compact.

The important part is enabling the agent to continue coherently, not returning giant payloads.

### Recommended return style

For movement tools:

- success or failure
- resolved place label if useful

For `show_nearby`:

- success
- category shown
- compact place list the agent can reference by name

For `open_place_street_view`:

- success or failure
- selected place label

The agent does not need raw frontend implementation details.

---

## Tool Implementation Take

Ayana tools should be treated as ACK-gated frontend-execution tools.

That means:

- the backend does not directly perform the visible scene/sidebar/street-view work
- the backend validates, orchestrates, and emits deterministic frontend actions
- the frontend executes the already-built runtime handlers
- the backend waits for ACK before telling the agent the action is complete

This is lighter than ThinkSpace's heavy background-generation tools, but it follows the same reliability rule.

### Where the visible work lives

The frontend should continue to own:

- city and landmark handlers
- sidebar show/hide behavior
- nearby place rendering
- street-view entry
- screenshot capture for post-ACK grounding

### Where orchestration lives

The backend should own:

- tool definitions
- accepted/completed/failed result envelopes
- `frontend_action` emission
- `frontend_ack` handling
- post-ACK semantic `send_content(...)`

---

## Suggested Nearby Result Shape

`show_nearby(category)` should return a grounded compact list such as:

```json
{
  "category": "food",
  "places": [
    {
      "name": "Kyoto Gogyo",
      "types": ["ramen", "restaurant"],
      "rating": 4.3,
      "user_rating_count": 1821,
      "address": "700 Shimogyo-ku, Kyoto",
      "lat": 35.0037,
      "lng": 135.7683
    },
    {
      "name": "Nishiki Market",
      "types": ["market", "food"],
      "rating": 4.5,
      "user_rating_count": 9412,
      "address": "609 Nishidaimonjicho, Kyoto",
      "lat": 35.005,
      "lng": 135.7648
    }
  ]
}
```

That is enough to let the agent say:

- `Let us peek into Kyoto Gogyo.`

and then call:

- `open_place_street_view(place_name="Kyoto Gogyo")`

---

## Phase Boundary

This orchestration phase is complete when:

1. the live agent is grounded on the generated itineraries and session state
2. the agent can call `choose_itinerary`
3. the agent can call `move_to_landmark`
4. the agent can call `show_nearby(category)`
5. the agent can call `open_place_street_view(place_name)`
6. silence can trigger a lightweight continuation nudge

### Current completion status

Today, this boundary is only partially met:

- items 1, 2, 3, 4, and 5 are implemented
- item 6 is still pending

---

## What Comes After This

If the simple continuation model proves insufficient, the next upgrade path is:

- add a more explicit reasoning pipeline as a second-brain layer
- improve adaptive pacing and redirection
- make scene progression more intentionally stateful

That is a future refinement, not the default starting point.
