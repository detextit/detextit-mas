"""
Haggle Market — Seller Agent HTTP Service

Single-buyer, no parallel sessions. One persistent ClaudeSDKClient holds the
conversation; context is carried by the SDK across turns, so /negotiate only
sends the buyer's latest message.

Run:  python server.py [--port 8000]
"""

import dataclasses
import json
import re
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import anthropic

from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
)

AGENT_CWD = str(Path(__file__).parent)
SYSTEM_PROMPT_FILE = Path(AGENT_CWD) / "system_prompt.md"
TRANSCRIPTS_DIR = Path(AGENT_CWD) / ".claude" / "memory" / "transcripts"
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def load_system_prompt() -> str:
    session_info = (
        f"\n# Session Information\n"
        f"Today's date: {datetime.now().strftime('%Y-%m-%d')}\n"
        f"Working directory: {AGENT_CWD}\n\n"
    )
    try:
        return SYSTEM_PROMPT_FILE.read_text() + session_info
    except FileNotFoundError:
        return "You are an AI seller agent for Haggle Market." + session_info


def build_options(session_id: str) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        system_prompt=load_system_prompt(),
        permission_mode="bypassPermissions",
        model="opus",
        tools=["Skill", "Write", "Edit", "Read", "Bash"],
        thinking={"type": "adaptive"},
        max_turns=30,
        cwd=AGENT_CWD,
        skills=["seller"],
        session_id=session_id,
    )

class NegotiateRequest(BaseModel):
    session_id: str
    player_id: Optional[str] = None
    product: dict
    buyer_message: Optional[str] = None


class NegotiateResponse(BaseModel):
    action: Optional[str] = None
    counter_offer: Optional[float] = None
    seller_message: str


_agent: Optional[ClaudeSDKClient] = None
_session_id: Optional[str] = None
_turn_count: int = 0
_last_activity: float = 0
_session_started: Optional[str] = None
_player_id: Optional[str] = None
_product_name: Optional[str] = None
SESSION_IDLE_TIMEOUT = 120  # seconds


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await _force_end_session()


app = FastAPI(title="Haggle Market Seller Agent", lifespan=lifespan)


async def _force_end_session():
    global _agent, _session_id, _turn_count, _last_activity, _session_started, _player_id, _product_name
    if _agent is not None:
        try:
            await _agent.__aexit__(None, None, None)
        except Exception as e:
            print(f"[cleanup] error closing stale agent: {e}")
        _agent = None
    _session_id = None
    _turn_count = 0
    _last_activity = 0
    _session_started = None
    _player_id = None
    _product_name = None


async def _get_or_create_agent(session_id: str) -> ClaudeSDKClient:
    global _agent, _session_id, _turn_count, _last_activity

    if _agent is not None and _session_id == session_id:
        _last_activity = time.monotonic()
        return _agent

    if _agent is not None:
        idle = time.monotonic() - _last_activity
        if idle >= SESSION_IDLE_TIMEOUT:
            print(f"[cleanup] auto-evicting stale session {_session_id} (idle {idle:.0f}s)")
            await _force_end_session()
        else:
            raise HTTPException(
                status_code=409,
                detail=f"Seller is currently helping another customer (session {_session_id}). Please wait.",
            )

    agent = ClaudeSDKClient(options=build_options(session_id))
    await agent.__aenter__()
    _agent = agent
    _session_id = session_id
    _turn_count = 0
    _last_activity = time.monotonic()
    _session_started = datetime.now().isoformat()
    return agent


_transcript_filenames: dict[str, str] = {}


def _generate_transcript_slug(session_id: str, product_name: Optional[str], player_id: Optional[str]) -> str:
    if session_id in _transcript_filenames:
        return _transcript_filenames[session_id]

    context_parts = [p for p in [product_name, player_id] if p]
    context = ", ".join(context_parts) if context_parts else session_id

    try:
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model="haiku",
            max_tokens=64,
            messages=[{"role": "user", "content": f"Generate a short 2-4 word slug (lowercase, hyphens, no extension) for a negotiation transcript about: {context}. Reply with ONLY the slug."}],
        )
        slug = resp.content[0].text.strip().lower().replace(" ", "-")
        slug = re.sub(r'[^a-z0-9\-]', '', slug)
    except Exception:
        slug = re.sub(r'[^a-z0-9\-]', '', (product_name or session_id[:8]).lower().replace(" ", "-"))

    date_suffix = datetime.now().strftime("%Y%m%d")
    filename = f"{slug}_{date_suffix}"
    _transcript_filenames[session_id] = filename
    return filename


def _save_transcript(session_id: str, turn: int, prompt: str, messages: list[dict], result_text: str):
    slug = _generate_transcript_slug(session_id, _product_name, _player_id)
    entry = {
        "timestamp": datetime.now().isoformat(),
        "session_id": session_id,
        "turn": turn,
        "input": prompt,
        "messages": messages,
        "result": result_text,
    }
    filepath = TRANSCRIPTS_DIR / f"{slug}.jsonl"
    with open(filepath, "a") as f:
        f.write(json.dumps(entry, default=str) + "\n")


def _parse_action(text: str) -> tuple[Optional[str], Optional[float], str]:
    pattern = r'```json\s*\n?\s*(\{[^}]+\})\s*\n?\s*```'
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        pattern = r'\n(\{"action"\s*:.+\})\s*$'
        match = re.search(pattern, text)

    if match:
        try:
            data = json.loads(match.group(1))
            message = text[: match.start()].strip()
            return data.get("action"), data.get("offer"), message
        except json.JSONDecodeError:
            pass

    return None, None, text.strip()


@app.post("/negotiate", response_model=NegotiateResponse)
async def negotiate(req: NegotiateRequest) -> NegotiateResponse:
    global _turn_count, _last_activity, _player_id, _product_name
    agent = await _get_or_create_agent(req.session_id)
    _turn_count += 1
    _last_activity = time.monotonic()
    if req.player_id:
        _player_id = req.player_id
    if req.product.get("name"):
        _product_name = req.product["name"]

    parts = []
    if _turn_count == 1:
        parts.append(f"<product_info>\n {json.dumps(req.product)}\n</product_info>")
    if req.buyer_message:
        parts.append(f"\n\n{req.buyer_message}")
    else:
        parts.append("(buyer sent empty message)")

    prompt = "\n".join(parts)
    print(f"\n{'='*60}")
    print(f"[negotiate] session={req.session_id}")
    print(f"[negotiate] prompt:\n{prompt}")
    print(f"{'='*60}")

    await agent.query(prompt)

    result_text = ""
    raw_messages = []
    async for msg in agent.receive_response():
        msg_type = msg.__class__.__name__
        print(f"\n--- {msg_type} ---")

        try:
            raw_messages.append(dataclasses.asdict(msg))
        except Exception:
            raw_messages.append({"_type": msg_type, "_str": str(msg)})

        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    print(f"  [TextBlock] {block.text[:200]}")
                elif isinstance(block, ThinkingBlock):
                    print(f"  [ThinkingBlock] {block.thinking[:200]}")
                elif isinstance(block, ToolUseBlock):
                    print(f"  [ToolUseBlock] {block.name}({json.dumps(block.input)[:200]})")
                else:
                    print(f"  [UnknownBlock] {block}")

        elif isinstance(msg, ResultMessage):
            result_text = msg.result or ""
            print(f"  session_id: {msg.session_id}")
            print(f"  num_turns: {msg.num_turns}")
            print(f"  cost: ${msg.total_cost_usd:.4f}")
            print(f"  duration: {msg.duration_ms}ms")
            print(f"  is_error: {msg.is_error}")
            print(f"  result (first 500): {result_text[:500]}")

        else:
            print(f"  raw: {msg}")

    print(f"\n{'='*60}")
    print(f"[negotiate] full result_text:\n{result_text}")
    print(f"{'='*60}\n")

    _save_transcript(req.session_id, _turn_count, prompt, raw_messages, result_text)

    if not result_text:
        raise HTTPException(status_code=502, detail="No response from agent")

    action, offer, seller_message = _parse_action(result_text)
    print(f"[negotiate] parsed -> action={action}, offer={offer}")
    print(f"[negotiate] seller_message: {seller_message[:300]}")

    return NegotiateResponse(
        action=action,
        counter_offer=offer,
        seller_message=seller_message or result_text,
    )


@app.post("/end-session")
async def end_session():
    old_session = _session_id
    await _force_end_session()
    return {"ended": old_session}


@app.get("/health")
async def health():
    idle = round(time.monotonic() - _last_activity, 1) if _last_activity else None
    return {
        "status": "ok",
        "active_session": _session_id,
        "player_id": _player_id,
        "product": _product_name,
        "turn_count": _turn_count,
        "session_started": _session_started,
        "idle_seconds": idle,
        "idle_timeout": SESSION_IDLE_TIMEOUT,
    }


if __name__ == "__main__":
    import uvicorn

    port = 8000
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
