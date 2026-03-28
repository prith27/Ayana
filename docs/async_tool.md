# Async Long-Running Tools With Frontend ACK

## Purpose

This document explains the ThinkSpace pattern for building async tools that:

- return immediately with `accepted`
- continue work in the background
- optionally drive frontend-visible UI or canvas actions
- wait for frontend acknowledgement before the tutor talks as if the UI changed

This is the implementation pattern behind:

- `canvas.generate_visual`
- `canvas.generate_graph`
- `canvas.generate_notation`
- `flashcards.create`
- `canvas.delegate_task`

It is the right pattern whenever backend completion and visible frontend state are
not the same moment.

## Core Rule

In ThinkSpace, backend success is not enough.

If the learner must see something new before the tutor can safely refer to it,
the system must wait for a `frontend_ack` before injecting tutoring-safe semantic
guidance.

That means the real lifecycle is not just:

1. tool starts
2. backend work finishes
3. tutor continues

It is:

1. tool starts
2. backend may return `accepted`
3. backend may later emit a `completed` or `failed` background result
4. frontend executes the related UI action
5. frontend sends `frontend_ack`
6. backend converts that ACK into `send_content(...)` only if the visible state is now trustworthy

## Mental Model

There are three different truths in this architecture:

### 1. Tool lifecycle truth

This comes from the tool result envelope:

- `accepted`
- `completed`
- `failed`

This answers: "What happened in backend execution?"

### 2. Frontend execution truth

This comes from `frontend_action` plus `frontend_ack`.

This answers: "Did the frontend actually apply the requested UI change?"

### 3. Tutor semantic truth

This comes from backend `send_content(...)` after ACK handling.

This answers: "What is it now safe for the tutor to say?"

Do not collapse these into one thing.

## The Two Channels

ThinkSpace uses two separate but connected channels:

### Channel A: tool results

Tool results describe backend job lifecycle:

- immediate return from the tool call
- later websocket `tool_result` messages for background completion/failure

Shape:

- `status`: `accepted | completed | failed`
- `tool`: `some.tool`
- `job.id`: `job-123`
- `summary`: `Human-readable summary`
- `payload`: tool-specific result data
- `frontend_action.type`: `some.frontend.action`
- `frontend_action.source_tool`: `some.tool`
- `frontend_action.job_id`: `job-123`
- `frontend_action.payload`: action-specific execution data

### Channel B: frontend acknowledgements

Frontend acknowledgements confirm whether the requested visible action actually happened.

Shape:

- `status`: `applied | failed`
- `action_type`: `some.frontend.action`
- `source_tool`: `some.tool`
- `job_id`: `job-123`
- `summary`: `What the frontend actually did`

## The Standard Pattern

Use this flow for new long-running tools.

### Phase 1: accept immediately

The tool validates input, creates a `job_id`, schedules async work, and returns an
`accepted` result.

That accepted result should usually include:

- `status: "accepted"`
- `tool`
- `job.id`
- a short holding-pattern `summary`
- optional `payload` with request metadata
- optional `frontend_action` if the frontend should immediately show loading state or gather data

Common examples:

- `canvas.context_requested`
- `canvas.delegate_requested`
- `flashcards.begin`
- `canvas.job_started`

### Phase 2: run background work

The backend background task does the expensive or multi-step work.

Typical work includes:

- waiting for fresh frontend context
- running a generator or reasoner
- planning placement
- persisting session/job state
- building the final frontend action

When the background task finishes, it publishes a normal tool result envelope to
the session-specific background result queue.

### Phase 3: relay background results

The websocket session relays background results back to the active frontend as:

- `type: "tool_result"`
- optional `type: "frontend_action"` if the result contains a `frontend_action`

This keeps async follow-up delivery aligned with the same tool result contract.

### Phase 4: let the frontend execute deterministically

The frontend should do one of two things:

- apply a deterministic UI change and ACK it
- perform a longer frontend-owned task and later report completion/failure

The frontend should not reinterpret backend semantics. It should execute the
action it was given and report the outcome.

### Phase 5: turn ACK into tutor-safe semantics

When the backend receives `frontend_ack`, it decides whether that ACK unlocks a
semantic update for the tutor.

This is the crucial step.

Some ACKs only confirm progress or loading state and should not produce tutoring
guidance.

Some ACKs confirm visible UI state and should produce `send_content(...)`.

## The Two Main Async Shapes

There are two important long-running shapes in ThinkSpace.

### Shape A: backend-managed job, frontend-confirmed visibility

Examples:

- `canvas.generate_visual`
- `canvas.generate_graph`
- `canvas.generate_notation`
- `flashcards.create`

Flow:

1. tool returns `accepted`
2. backend does work in background
3. backend emits a later `completed` result with a deterministic `frontend_action`
4. frontend applies that action
5. frontend sends `frontend_ack`
6. backend sends semantic tutor guidance only after that ACK

Use this when the backend owns the real work and the frontend is mainly the final executor.

### Shape B: backend-managed orchestration, frontend-managed work

Example:

- `canvas.delegate_task`

Flow:

1. tool returns `accepted`
2. backend sends `canvas.delegate_requested`
3. frontend ACKs that the delegate task started
4. frontend performs the long-running work itself
5. frontend later sends `canvas_delegate_result`
6. backend publishes a background tool result
7. backend sends semantic tutor guidance based on delegate completion

Use this when the frontend owns the actual long-running operation, such as a local editor worker.

## What Counts As An ACK Gate

Use ACK gating whenever one of these is true:

- the tutor must not speak until the learner can see the result
- the frontend might fail to apply the action
- the backend can finish before the visible state is actually updated
- the action changes study state, not just internal runtime state

Examples that should be ACK-gated:

- visual inserted into canvas
- widget inserted into canvas
- flashcard deck shown
- flashcard answer revealed
- flashcard card advanced

Examples that usually should not create tutoring semantics on ACK:

- loading toast shown
- context capture started
- interpreter progress cue shown

Those ACKs still matter operationally, but they usually should not change what the tutor says.

## Recommended Build Recipe

Follow this checklist when adding a new async tool.

### 1. Define the tool result envelope

Your tool should emit the shared result shape:

- `status`
- `tool`
- `job`
- `summary`
- `payload`
- `frontend_action`

Use the existing helper pattern:

- `_build_tool_result(...)`
- `_build_frontend_action(...)`

### 2. Allocate a stable `job_id`

Every long-running tool should create a unique `job_id` immediately.

That `job_id` must travel through:

- the accepted tool result
- background completion/failure result
- any frontend action
- the frontend ACK
- trace files and debug logs

Without a shared `job_id`, you cannot reliably correlate the lifecycle.

### 3. Return `accepted` fast

Do not block the tool call on the actual long-running work.

The initial result should usually instruct the tutor to stay on the same topic
without pretending the result is already visible.

Good accepted-summary style:

- keep the conversation warm
- avoid dead air
- do not ask a new question
- do not introduce a new topic

### 4. If needed, request fresh frontend state

If the job depends on current canvas or UI state, request that data at tool time.

ThinkSpace uses this for canvas-aware tools:

1. backend creates a per-job future
2. backend sends `canvas.context_requested`
3. frontend captures fresh context
4. frontend returns `canvas_context_response`
5. background job waits for the matching response

Do not rely on stale or connection-time snapshots for placement-sensitive tools.

### 5. Publish background completion through the websocket result path

When the job completes, publish a normal result envelope to the background result queue.

The websocket layer should then:

- send `tool_result`
- extract and send `frontend_action` if present
- optionally send semantic failure updates for failed jobs

This keeps async delivery uniform across tool families.

### 6. Make the frontend action deterministic

A frontend action should tell the client exactly what to do, not vaguely what to mean.

Good:

- insert this visual at `x/y/w/h`
- show this deck
- reveal the current answer

Bad:

- help the learner understand the graph
- improve the board

### 7. ACK only after the visible state is real

The frontend should send `status: "applied"` only after the requested visible state is truly applied.

For example:

- after the canvas shape is inserted
- after the widget render succeeds
- after the flashcard state is updated
- after any focused screenshot capture that is part of the success path

If execution fails, send `status: "failed"` with a useful summary.

### 8. Convert only meaningful ACKs into `send_content(...)`

The backend ACK handler should decide which acknowledgements unlock tutor-safe semantics.

Current ThinkSpace behavior:

- `canvas.insert_visual` ACK -> safe to explain the visible visual
- `canvas.insert_widget` ACK -> safe to explain the visible widget
- `flashcards.show` ACK -> safe to ask the exact visible question
- some loading/progress ACKs -> no semantic tutor update

This filtering is what prevents the tutor from narrating invisible state.

### 9. Add failure semantics separately

Background job failures should usually produce a semantic failure update even
without any frontend ACK, because the tutor needs to react to the failure.

Good failure semantic style:

- name the tool that failed
- include a short reason
- tell the tutor what kind of recovery move is appropriate

### 10. Add per-job traceability

Any async tool with multiple steps should record trace data per job.

Recommended trace contents:

- inputs
- timing
- wait durations
- context request/response details
- emitted payload summary
- final status
- error details

## A Concrete Timeline

This is the best default timeline for a new backend-owned long-running tool.

### Accepted phase

1. validate inputs
2. allocate `job_id`
3. create any required pending request state
4. schedule background task
5. return `accepted`
6. optionally emit a lightweight frontend action for loading or context gathering

### Completion phase

1. background task finishes real work
2. build `completed` result
3. include deterministic `frontend_action`
4. publish result to background queue
5. websocket relays `tool_result`
6. websocket relays `frontend_action`

### Visible confirmation phase

1. frontend executes the action
2. frontend sends `frontend_ack`
3. backend normalizes the ACK
4. backend maps ACK to semantic text if appropriate
5. backend sends `send_content(...)`

## Backend Structure To Reuse

For a new async tool, you will usually need these pieces.

### Tool module

Responsibilities:

- validate inputs
- create `job_id`
- schedule background task
- return accepted result

### Background job function

Responsibilities:

- perform expensive work
- wait for any per-job frontend response
- build final `completed` or `failed` result
- publish the result

### Websocket relay

Responsibilities:

- send background `tool_result`
- send extracted `frontend_action`
- send semantic failure updates when appropriate

### ACK handler

Responsibilities:

- normalize ACK payload
- identify which action types matter semantically
- inject tutor-safe `send_content(...)` only for those action types

## Frontend Structure To Reuse

For a new async tool, the frontend should usually have these pieces.

### Transport types

Add or reuse:

- `FrontendActionType`
- `FrontendAction`
- `FrontendAck`
- `ToolResultEnvelope`

### WebSocket queueing

The websocket hook should:

- queue incoming `frontend_action`s
- expose the latest `tool_result`
- provide a `sendFrontendAck(...)` helper

### Action executor

The session surface should:

- pull the next frontend action from the queue
- validate payload shape
- execute the action
- send `frontend_ack`
- report a precise failure summary if the action cannot be applied

## Choosing Between `frontend_ack` And A Custom Result Message

Use `frontend_ack` when the frontend is confirming that it applied a backend-requested action.

Use a separate message like `canvas_delegate_result` when:

- the frontend owns the actual long-running work
- the backend asked the frontend to start a process, not just apply a deterministic one-step action
- you need a later completion/failure report beyond simple action application

Rule of thumb:

- deterministic execution confirmation -> `frontend_ack`
- frontend-owned long-running workflow completion -> custom result message

## Common Mistakes

### Mistake 1: treating backend `completed` as visible completion

This causes the tutor to talk ahead of the UI.

### Mistake 2: using vague frontend actions

The frontend should execute, not reinterpret orchestration intent.

### Mistake 3: sending `applied` too early

Only ACK success after the real UI change is present.

### Mistake 4: forgetting failure summaries

If the frontend or backend fails, the summary string is part of the recovery path.

### Mistake 5: skipping `job_id` propagation

That breaks traceability and ACK correlation.

### Mistake 6: mixing semantic tutoring guidance into the frontend action itself

The frontend action should be operational. Tutor guidance belongs in backend semantic follow-up.

## Decision Guide

Ask these questions when designing a new tool.

### Should this tool be long-running?

Usually yes if it:

- calls a model or external service
- waits on frontend context
- performs multi-step generation or planning
- can outlive the initial tool-call turn

### Should it emit a frontend action?

Yes if the frontend must visibly do something because of the tool result.

### Should it require ACK-gated tutor semantics?

Yes if the tutor must not speak until the learner can actually see the result.

### Should the frontend own the long-running work?

Only if the actual operation is inherently local to the frontend runtime, like a canvas worker acting on the editor.

## Minimal Pseudocode Template

```python
def some_async_tool(arg: str, tool_context: ToolContext | None = None) -> dict[str, object]:
    job_id = f"some-tool-{uuid4()}"
    user_id, session_id = _get_session_identity(tool_context)
    if not user_id or not session_id:
        return _build_tool_result(
            status="failed",
            tool="some.tool",
            summary="This tool requires an active session context",
            job_id=job_id,
        )

    asyncio.get_running_loop().create_task(
        _run_some_async_job(
            user_id=user_id,
            session_id=session_id,
            job_id=job_id,
            arg=arg.strip(),
        )
    )

    return _build_tool_result(
        status="accepted",
        tool="some.tool",
        summary="Started work. Stay on the same topic until the result is ready.",
        payload={"arg": arg.strip()},
        frontend_action=_build_frontend_action(
            "some.loading_or_request_action",
            "some.tool",
            {"title": "Working", "message": "Preparing the result"},
            job_id=job_id,
        ),
        job_id=job_id,
    )
```

```python
async def _run_some_async_job(*, user_id: str, session_id: str, job_id: str, arg: str) -> None:
    try:
        artifact = await do_expensive_work(arg)
        result = _build_tool_result(
            status="completed",
            tool="some.tool",
            summary="Prepared the result for frontend insertion",
            payload={"artifact_id": artifact["id"]},
            frontend_action=_build_frontend_action(
                "some.visible_action",
                "some.tool",
                artifact,
                job_id=job_id,
            ),
            job_id=job_id,
        )
    except Exception as exc:
        result = _build_tool_result(
            status="failed",
            tool="some.tool",
            summary=f"Tool failed: {exc}",
            job_id=job_id,
        )

    await publish_some_job_result(
        user_id=user_id,
        session_id=session_id,
        result=result,
    )
```

Frontend side:

- detect `some.visible_action`
- apply the requested visible action
- send `frontend_ack` with:
- `status`: `applied` or `failed`
- `action_type`: `some.visible_action`
- `source_tool`: the backend tool that emitted it
- `job_id`: the shared job identifier
- `summary`: the concrete frontend outcome

Backend ACK side:

```python
if ack["status"] == "applied" and ack["action_type"] == "some.visible_action":
    live_request_queue.send_content(
        types.Content(parts=[types.Part(text="The result is now visible in the UI.")])
    )
```

## When Not To Use This Pattern

Do not use this full async-plus-ACK pattern if:

- the tool is fully synchronous and does not affect visible frontend state
- the tool result is already safe to reason from immediately
- the frontend does not need to execute anything

In those cases, a normal synchronous tool result is enough.

## Current File Map

These are the main reference implementations for this pattern:

- `docs/thinkspace-end-to-end-technical-architecture.md`
- `docs/tool-result-contract.md`
- `docs/frontend-action-contract.md`
- `docs/flashcard-grounding-and-ui-confirmation.md`
- `backend/app/main.py`
- `backend/app/thinkspace_agent/tools/canvas_visuals.py`
- `backend/app/thinkspace_agent/tools/canvas_widgets.py`
- `backend/app/thinkspace_agent/tools/flashcards.py`
- `backend/app/thinkspace_agent/tools/canvas_delegate.py`
- `backend/app/thinkspace_agent/tools/canvas_context_requests.py`
- `frontend/client/types/agent-live.ts`
- `frontend/client/hooks/useAgentWebSocket.ts`
- `frontend/client/pages/SessionCanvas.tsx`
- `frontend/client/flashcards.ts`

## Recommended Design Rule

If a tool changes what the learner can see, the tutor should reason from the ACKed
visible state, not from backend intent.

That one rule is the reason this pattern feels reliable instead of racy.
