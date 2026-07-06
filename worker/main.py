import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from tts_engine import TtsEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

engine = TtsEngine()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    engine.load()
    yield


app = FastAPI(title="IndicF5 Model Server", lifespan=lifespan)


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.get("/health")
def health():
    return {
        "status": "ok" if engine.loaded else "loading",
        "model_loaded": engine.loaded,
        "device": engine.device,
    }


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest):
    if not engine.loaded:
        raise HTTPException(status_code=503, detail="Model still loading")
    try:
        wav_bytes = engine.synthesize(req.text)
    except Exception as exc:
        logger.exception("Synthesis failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return Response(content=wav_bytes, media_type="audio/wav")
