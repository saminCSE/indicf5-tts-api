import io
import logging
import os
import threading

import numpy as np
import soundfile as sf
from huggingface_hub import hf_hub_download

logger = logging.getLogger("tts_engine")

MODEL_ID = os.environ.get("MODEL_ID", "ai4bharat/IndicF5")
REF_AUDIO_FILE = os.environ.get("REF_AUDIO_FILE", "prompts/PAN_F_HAPPY_00001.wav")
REF_TEXT = os.environ.get(
    "REF_TEXT",
    "ਭਹੰਪੀ ਵਿੱਚ ਸਮਾਰਕਾਂ ਦੇ ਭਵਨ ਨਿਰਮਾਣ ਕਲਾ ਦੇ ਵੇਰਵੇ ਗੁੰਝਲਦਾਰ ਅਤੇ ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਹਨ, ਜੋ ਮੈਨੂੰ ਖੁਸ਼ ਕਰਦੇ ਹਨ।",
)
SAMPLE_RATE = 24000


def pick_device() -> str:
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class TtsEngine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._ref_audio_path: str | None = None
        self.device = "unloaded"

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        from transformers import AutoModel

        preferred = pick_device()
        logger.info("Loading %s (preferred device: %s) ...", MODEL_ID, preferred)
        model = AutoModel.from_pretrained(
            MODEL_ID,
            trust_remote_code=True,
            low_cpu_mem_usage=False,
        )
        self.device = "cpu"
        if preferred != "cpu":
            try:
                model = model.to(preferred)
                self.device = preferred
            except (NotImplementedError, RuntimeError) as exc:
                logger.warning(
                    "Could not move model to %s (%s); staying on cpu", preferred, exc
                )
        self._model = model

        self._ref_audio_path = hf_hub_download(MODEL_ID, REF_AUDIO_FILE)
        logger.info("Model loaded, reference audio at %s", self._ref_audio_path)

    def synthesize(self, text: str) -> bytes:
        if self._model is None:
            raise RuntimeError("Model not loaded")
        with self._lock:
            audio = self._model(
                text,
                ref_audio_path=self._ref_audio_path,
                ref_text=REF_TEXT,
            )
        samples = np.asarray(audio, dtype=np.float32)
        if samples.size and np.abs(samples).max() > 1.0:
            samples = samples / 32768.0
        buf = io.BytesIO()
        sf.write(buf, samples, samplerate=SAMPLE_RATE, format="WAV")
        return buf.getvalue()
