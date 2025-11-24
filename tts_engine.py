import asyncio
import logging
from pathlib import Path
from typing import Optional

import pyttsx3

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class TextToSpeechEngine:
    """Offline TTS via Windows SAPI using pyttsx3."""

    def __init__(self, voice_name: Optional[str] = None, speaking_rate: int = 180):
        self.voice_name = voice_name
        self.speaking_rate = speaking_rate
        self._lock = asyncio.Lock()
        self.ready = True
        logger.info("pyttsx3 will be initialized per request (Windows-friendly).")

    async def speak_to_file(self, text: str, file_path: str) -> None:
        if not self.ready:
            raise RuntimeError("Text-to-speech engine is not ready.")

        output_path = Path(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._speak_sync, text, output_path)

    def _speak_sync(self, text: str, output_path: Path) -> None:
        engine = pyttsx3.init()
        try:
            if self.voice_name:
                for voice in engine.getProperty("voices"):
                    if voice.name == self.voice_name or voice.id == self.voice_name:
                        engine.setProperty("voice", voice.id)
                        break

            engine.setProperty("rate", self.speaking_rate)
            logger.info("Synthesizing speech to %s", output_path)
            engine.save_to_file(text, str(output_path))
            engine.runAndWait()

            if not output_path.exists():
                raise RuntimeError(f"TTS output file was not created: {output_path}")
        except Exception as exc:
            raise RuntimeError(f"TTS synthesis failed: {exc}") from exc
        finally:
            engine.stop()