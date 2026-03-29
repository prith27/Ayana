# Ayana Primitives Story

This document is the implementation scratchpad for the Ayana primitives phase.

It captures what is already locked for the current build step before agent orchestration.

---

## Status Note

This document is now a historical primitives reference rather than the active implementation driver.

### Current reality

- the primitives phase has been substantially completed
- prep generation is implemented
- runtime city movement is implemented
- runtime landmark movement is implemented
- live-agent orchestration has already started on top of those primitives

### Important divergence from older notes below

Some older sections in this scratchpad reflect earlier thinking before the orchestration contract was finalized.

In particular:

- the active orchestration contract now uses free-text `landmark_name` for `move_to_landmark`
- off-itinerary landmarks are allowed inside the active city context
- the current source of truth for orchestration sequencing is:
  - `docs/AYANA_ORCHESTRATION_STORY.md`
  - `docs/AYANA_ORCHESTRATION_PHASE_PLAN.md`

---

## Purpose

The purpose of this phase is to establish the minimum data and runtime primitives Ayana needs so the frontend can stop depending on hardcoded Tokyo/Japan progression.

This phase is about:

- generating itinerary options
- wiring the frontend to consume those options
- keeping the live session off
- preparing the system for later orchestration

This phase is not about:

- proactive agent orchestration
- voice-choice interpretation
- final runtime tool contracts

---

## Locked Product Decisions

The following are locked for this implementation phase:

- personas are hardcoded
- the canonical persona set is:
  - `adventure`
  - `romantic`
  - `peaceful`
- after persona selection, the system enters a preparatory generation stage
- Ayana live session does **not** start during this stage
- backend owns the LLM calls
- frontend calls one combined backend prep endpoint
- that endpoint returns:
  - 3 itinerary options
  - associated generated data needed for this phase
- frontend now uses a prep-first globe flow:
  - persona selection
  - globe-centered loading state
  - generated itinerary overlay
- runtime geocoding is the chosen approach
- city and landmark movement will use runtime name resolution
- landmark and city names in generated outputs must be clear and canonical
- the frontend will later test primitives through manual handlers

---

## Phase Boundary

This phase ends once itinerary generation and itinerary-driven frontend primitives are in place.

This phase does **not** yet include:

- experience metadata JSON finalization
- full metadata-driven overlay replacement
- agent orchestration
- voice-only choice resolution

---

## Combined Backend Prep Endpoint

For this phase, the backend surface is a single prep endpoint.

### Input

```json
{
  "persona": "adventure"
}
```

### Output shape

At a high level:

```json
{
  "persona": "adventure",
  "itineraries": [
    { "...": "itinerary option 1" },
    { "...": "itinerary option 2" },
    { "...": "itinerary option 3" }
  ]
}
```

The exact itinerary option structure is locked below.

---

## Locked Itinerary Option Shape

One itinerary option should represent one city-level travel experience candidate.

### Itinerary option

```json
{
  "id": "tokyo_adventure_01",
  "city_name": "Tokyo",
  "country_name": "Japan",
  "title": "Tokyo After Dark",
  "pitch": "A fast, sensory itinerary through neon streets, hidden alleys, and iconic city energy.",
  "why_it_fits_persona": "Fits an adventure traveler through high-energy streets, contrast, and movement.",
  "city_facts": [
    "Tokyo blends hypermodern districts with centuries-old traditions.",
    "Its rail network and neighborhood density make each district feel like a different world."
  ],
  "landmarks": [
    { "...": "landmark object 1" },
    { "...": "landmark object 2" },
    { "...": "landmark object 3" }
  ]
}
```

### Required fields

- `id`
- `city_name`
- `country_name`
- `title`
- `pitch`
- `why_it_fits_persona`
- `city_facts`
- `landmarks`

### Notes

- `city_facts` should be short, usable by the agent later, and grounded enough to support narration.
- There is no itinerary-level sightseeing/food/activity/shopping category field. Those distinctions live at the landmark level instead.

---

## Locked Landmark Shape

Each itinerary contains an ordered list of landmarks that can be explored.

### Landmark object

```json
{
  "id": "shibuya_crossing",
  "name": "Shibuya Crossing",
  "short_label": "Shibuya",
  "order_index": 1,
  "why_this_stop": "This stop captures the kinetic energy of Tokyo immediately.",
  "facts": [
    "It is one of the world's best-known pedestrian crossings.",
    "The surrounding district is a symbol of contemporary Tokyo street culture."
  ],
  "facets": [
    "sightseeing",
    "food",
    "shopping"
  ]
}
```

### Required fields

- `id`
- `name`
- `order_index`
- `why_this_stop`
- `facts`
- `facets`

### Optional fields

- `short_label`

### Notes

- `name` must be geocoding-friendly and clear enough for runtime lookup.
- `facts` should be compact and useful later for narration.
- `facets` replaces the need for itinerary-level category fields.
- `order_index` expresses the suggested order for exploration.

---

## Frontend Expectations For This Phase

The frontend should assume:

- it receives 3 itinerary options after persona selection
- each itinerary already contains:
  - city identity
  - city facts
  - ordered landmark list
  - landmark facts
  - landmark facets

The frontend should not yet assume:

- coordinates are present
- the agent is orchestrating movement

---

## Runtime Assumption

For this phase:

- the frontend will resolve `city_name`
- the frontend will resolve `landmark.name`
- movement remains runtime-geocoded

This is the hackathon simplification choice.

---

## Overlay Payload On Tool Calls

We are no longer keeping a separate `experience_metadata` contract in the prep response.

Instead:

- the prep response returns itinerary data only
- the agent is grounded on the available overlay presets
- the tool call itself carries the minimal overlay payload needed by the frontend

### Overlay preset enum

The allowed preset family is:

- `urban-neon`
- `tropical`
- `heritage`
- `modern-minimal`
- `nature`

### Why this is the simpler model

`CityOverlay` fundamentally needs only:

- a display name
- an overlay preset
- a tagline

So we do not need a second generated metadata layer just to store those values in advance.

### Locked tool-call shape

The intended tool surface is:

- `choose_itinerary(itinerary_id, city_name, overlay_preset, tagline)`
- `move_to_landmark(landmark_id, landmark_name, overlay_preset, tagline)`

### Rules

- `itinerary_id` must come from the generated itinerary options
- `landmark_id` must come from the currently active itinerary only
- `city_name` and `landmark_name` are the geocoding inputs
- `overlay_preset` must be one of the allowed enum values
- `tagline` is generated free text
- off-plan landmarks are not navigable in v1

### Frontend implication

The frontend will use:

- `city_name` plus `overlay_preset` plus `tagline` to drive `CityOverlay` for itinerary selection
- `landmark_name` plus `overlay_preset` plus `tagline` to drive landmark transition overlays later

The frontend still owns:

- gradient definitions
- accent styling
- animation timing
- typography

### Recommended combined prep response

The backend prep response should now be treated as:

```json
{
  "persona": "adventure",
  "itineraries": [
    {
      "id": "tokyo_adventure_01",
      "city_name": "Tokyo",
      "country_name": "Japan",
      "title": "Tokyo After Dark",
      "pitch": "A fast, sensory itinerary through neon streets, hidden alleys, and iconic city energy.",
      "why_it_fits_persona": "Fits an adventure traveler through high-energy streets, contrast, and movement.",
      "city_facts": [
        "Tokyo blends hypermodern districts with centuries-old traditions."
      ],
      "landmarks": [
        {
          "id": "shibuya_crossing",
          "name": "Shibuya Crossing",
          "order_index": 1,
          "why_this_stop": "This stop captures the kinetic energy of Tokyo immediately.",
          "facts": [
            "It is one of the world's best-known pedestrian crossings."
          ],
          "facets": [
            "sightseeing",
            "food",
            "shopping"
          ]
        }
      ]
    }
  ]
}
```

---

## What Comes Next

With itinerary shape, prep overlays, and overlay tool-call shape now locked, the next step is runtime primitives:

- move from selected generated itinerary into city transition
- replace hardcoded city entry with generated itinerary data
- add landmark transition primitives driven by itinerary ids and names
- keep live session disabled until those runtime primitives are stable
