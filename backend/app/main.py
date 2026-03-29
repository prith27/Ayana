"""FastAPI application demonstrating ADK Gemini Live API Toolkit with WebSocket."""

import asyncio
import base64
import json
import logging
import os
import warnings
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Load environment variables from .env file BEFORE importing agent
load_dotenv(Path(__file__).parent / ".env")

# Import agent after loading environment variables
# pylint: disable=wrong-import-position
from ayana_orchestration import (  # noqa: E402
    apply_frontend_ack,
    build_frontend_action_message,
    build_tool_result_message,
    extract_frontend_action,
    get_or_create_session_state,
    hydrate_session_from_prep,
    normalize_frontend_ack,
    record_image_for_job,
    register_pending_job,
    register_result_queue,
    unregister_result_queue,
)
from ayana_prep.router import router as ayana_prep_router  # noqa: E402
from ayana_recap.router import router as ayana_recap_router  # noqa: E402
from ayana_tool_handlers import build_post_ack_followup  # noqa: E402
from ayana_agent.agent import agent  # noqa: E402

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Suppress Pydantic serialization warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# Application name constant
APP_NAME = "bidi-demo"
USE_VERTEX_AI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().upper() == "TRUE"
DEMO_AGENT_VOICE = os.getenv("DEMO_AGENT_VOICE", "Gacrux").strip() or "Gacrux"

# ========================================
# Phase 1: Application Initialization (once at startup)
# ========================================

app = FastAPI()
app.include_router(ayana_prep_router)
app.include_router(ayana_recap_router)

# Mount static files
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Define your session service
session_service = InMemorySessionService()

# Define your runner
runner = Runner(app_name=APP_NAME, agent=agent, session_service=session_service)


def get_session_resumption_config():
    """Return session resumption config only when the backend supports it."""
    if USE_VERTEX_AI:
        return types.SessionResumptionConfig()
    return None

# ========================================
# HTTP Endpoints
# ========================================


@app.get("/")
async def root():
    """Serve the index.html page."""
    return FileResponse(Path(__file__).parent / "static" / "index.html")


# ========================================
# WebSocket Endpoint
# ========================================


@app.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    prep_id: str | None = None,
    proactivity: bool = False,
    affective_dialog: bool = False,
) -> None:
    """WebSocket endpoint for bidirectional streaming with ADK.

    Args:
        websocket: The WebSocket connection
        user_id: User identifier
        session_id: Session identifier
        proactivity: Enable proactive audio (native audio models only)
        affective_dialog: Enable affective dialog (native audio models only)
    """
    logger.debug(
        f"WebSocket connection request: user_id={user_id}, session_id={session_id}, "
        f"prep_id={prep_id}, proactivity={proactivity}, "
        f"affective_dialog={affective_dialog}"
    )
    await websocket.accept()
    logger.info(
        "WebSocket connection accepted: user_id=%s session_id=%s prep_id=%s",
        user_id,
        session_id,
        prep_id,
    )
    if not prep_id:
        logger.warning("WebSocket connection missing prep_id; closing session")
        await websocket.close(code=1008, reason="Missing prep_id")
        return

    # ========================================
    # Phase 2: Session Initialization (once per streaming session)
    # ========================================

    # Automatically determine response modality based on model architecture
    # Native audio models (containing "native-audio" in name)
    # ONLY support AUDIO response modality.
    # Half-cascade models support both TEXT and AUDIO,
    # we default to TEXT for better performance.
    model_name = agent.model
    is_native_audio = "native-audio" in model_name.lower()

    if is_native_audio:
        # Native audio models require AUDIO response modality
        # with audio transcription
        response_modalities = ["AUDIO"]

        # Build RunConfig with optional proactivity and affective dialog
        # These features are only supported on native audio models
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=DEMO_AGENT_VOICE
                    )
                )
            ),
            session_resumption=get_session_resumption_config(),
            proactivity=(
                types.ProactivityConfig(proactive_audio=True)
                if proactivity
                else None
            ),
            enable_affective_dialog=affective_dialog
            if affective_dialog
            else None,
        )
        logger.debug(
            f"Native audio model detected: {model_name}, "
            f"using AUDIO response modality, "
            f"voice={DEMO_AGENT_VOICE}, "
            f"proactivity={proactivity}, affective_dialog={affective_dialog}"
        )
    else:
        # Half-cascade models support TEXT response modality
        # for faster performance
        response_modalities = ["TEXT"]
        run_config = RunConfig(
            streaming_mode=StreamingMode.BIDI,
            response_modalities=response_modalities,
            input_audio_transcription=None,
            output_audio_transcription=None,
            session_resumption=get_session_resumption_config(),
        )
        logger.debug(
            f"Half-cascade model detected: {model_name}, "
            "using TEXT response modality"
        )
        # Warn if user tried to enable native-audio-only features
        if proactivity or affective_dialog:
            logger.warning(
                f"Proactivity and affective dialog are only supported on native "
                f"audio models. Current model: {model_name}. "
                f"These settings will be ignored."
            )
    logger.debug(f"RunConfig created: {run_config}")

    # Get or create session (handles both new sessions and reconnections)
    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

    live_request_queue = LiveRequestQueue()
    tool_result_queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
    get_or_create_session_state(session_id)
    if not hydrate_session_from_prep(session_id, prep_id):
        logger.warning(
            "WebSocket connection received unknown prep_id=%s; closing session",
            prep_id,
        )
        await websocket.close(code=1008, reason="Unknown prep_id")
        return
    register_result_queue(session_id, tool_result_queue)

    # ========================================
    # Phase 3: Active Session (concurrent bidirectional communication)
    # ========================================

    async def _send_tool_result_message(result: dict[str, object]) -> None:
        await websocket.send_text(json.dumps(build_tool_result_message(result)))

    async def _send_frontend_action_message(
        frontend_action: dict[str, object],
    ) -> None:
        job_id = frontend_action.get("job_id")
        source_tool = frontend_action.get("source_tool")
        action_type = frontend_action.get("action_type")
        payload = frontend_action.get("payload")
        if (
            isinstance(job_id, str)
            and isinstance(source_tool, str)
            and isinstance(action_type, str)
        ):
            register_pending_job(
                session_id,
                job_id=job_id,
                tool=source_tool,
                status="accepted",
                action_type=action_type,
                payload=payload if isinstance(payload, dict) else None,
            )
        await websocket.send_text(
            json.dumps(build_frontend_action_message(frontend_action))
        )

    async def upstream_task() -> None:
        """Receives messages from WebSocket and sends to LiveRequestQueue."""
        logger.debug("upstream_task started")
        while True:
            # Receive message from WebSocket (text or binary)
            message = await websocket.receive()

            # Handle binary frames (audio data)
            if "bytes" in message:
                audio_data = message["bytes"]
                logger.debug(
                    f"Received binary audio chunk: {len(audio_data)} bytes"
                )

                audio_blob = types.Blob(
                    mime_type="audio/pcm;rate=16000", data=audio_data
                )
                live_request_queue.send_realtime(audio_blob)

            # Handle text frames (JSON messages)
            elif "text" in message:
                text_data = message["text"]
                logger.debug(f"Received text message: {text_data[:100]}...")

                json_message = json.loads(text_data)

                # Extract text from JSON and send to LiveRequestQueue
                if json_message.get("type") == "text":
                    logger.debug(
                        f"Sending text content: {json_message['text']}"
                    )
                    content = types.Content(
                        parts=[types.Part(text=json_message["text"])]
                    )
                    live_request_queue.send_content(content)

                # Handle image data
                elif json_message.get("type") == "image":
                    logger.debug("Received image data")

                    # Decode base64 image data
                    image_data = base64.b64decode(json_message["data"])
                    mime_type = json_message.get("mimeType", "image/jpeg")

                    logger.debug(
                        f"Sending image: {len(image_data)} bytes, "
                        f"type: {mime_type}"
                    )

                    job_id = json_message.get("job_id")
                    if isinstance(job_id, str) and job_id:
                        record_image_for_job(
                            session_id,
                            job_id,
                            mime_type=mime_type,
                        )

                    # Send image as blob
                    image_blob = types.Blob(
                        mime_type=mime_type, data=image_data
                    )
                    live_request_queue.send_realtime(image_blob)

                elif json_message.get("type") == "frontend_ack":
                    ack = normalize_frontend_ack(json_message.get("ack"))
                    if ack is None:
                        logger.warning(
                            "Received invalid frontend_ack payload: %s",
                            text_data,
                        )
                        continue
                    logger.debug("Received frontend ack: %s", json.dumps(ack))
                    apply_frontend_ack(session_id, ack)
                    followup_text = build_post_ack_followup(session_id, ack)
                    if followup_text:
                        live_request_queue.send_content(
                            types.Content(
                                parts=[types.Part(text=followup_text)]
                            )
                        )

    async def downstream_task() -> None:
        """Receives Events from run_live() and sends to WebSocket."""
        logger.debug("downstream_task started, calling runner.run_live()")
        logger.debug(
            f"Starting run_live with user_id={user_id}, session_id={session_id}"
        )
        async for event in runner.run_live(
            user_id=user_id,
            session_id=session_id,
            live_request_queue=live_request_queue,
            run_config=run_config,
        ):
            event_json = event.model_dump_json(exclude_none=True, by_alias=True)
            logger.debug(f"[SERVER] Event: {event_json}")
            await websocket.send_text(event_json)
        logger.debug("run_live() generator completed")

    async def background_tool_result_task() -> None:
        """Relays queued tool results and extracted frontend actions."""
        logger.debug("background_tool_result_task started")
        while True:
            result = await tool_result_queue.get()
            await _send_tool_result_message(result)
            frontend_action = extract_frontend_action(result)
            if frontend_action is not None:
                await _send_frontend_action_message(frontend_action)

    # Run both tasks concurrently
    # Exceptions from either task will propagate and cancel the other task
    try:
        logger.debug(
            "Starting asyncio.gather for upstream, downstream, and result tasks"
        )
        await asyncio.gather(
            upstream_task(),
            downstream_task(),
            background_tool_result_task(),
        )
        logger.debug("asyncio.gather completed normally")
    except WebSocketDisconnect as exc:
        logger.info(
            "Client websocket disconnected: user_id=%s session_id=%s code=%s",
            user_id,
            session_id,
            exc.code,
        )
    except Exception as e:
        logger.error(
            "Unexpected error in streaming tasks for session_id=%s: %s",
            session_id,
            e,
            exc_info=True,
        )
    finally:
        # ========================================
        # Phase 4: Session Termination
        # ========================================

        # Always close the queue, even if exceptions occurred
        logger.info("Closing live session resources for session_id=%s", session_id)
        live_request_queue.close()
        unregister_result_queue(session_id)
