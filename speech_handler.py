import asyncio
import logging
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import speech_recognition as sr

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class SpeechRecognizer:
    """SpeechRecognition wrapper that converts WebM → WAV → text."""
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.ready = True

    async def transcribe(self, webm_path: str) -> Optional[str]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._transcribe_sync, webm_path)

    def _transcribe_sync(self, webm_path: str) -> Optional[str]:
        wav_path = self._convert_to_wav(webm_path)

        with sr.AudioFile(str(wav_path)) as source:
            audio = self.recognizer.record(source)

        try:
            text = self.recognizer.recognize_google(audio)
            logger.info("Google Web Speech transcription: %s", text)
            return text.strip()
        except sr.UnknownValueError:
            logger.warning("Speech was unintelligible.")
            return None
        except sr.RequestError as exc:
            logger.error("Google Web Speech service unavailable: %s", exc)
            raise RuntimeError("Speech recognition service is currently unavailable.") from exc
        finally:
            if wav_path.exists():
                wav_path.unlink(missing_ok=True)

    def _convert_to_wav(self, webm_path: str) -> Path:
        wav_file = Path(tempfile.gettempdir()) / (Path(webm_path).stem + "_converted.wav")

        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",         # overwrite existing file
                    "-i", webm_path,
                    "-ac", "1",   # mono
                    "-ar", "16000",
                    str(wav_file),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                "FFmpeg is required but was not found. "
                "Install it and ensure ffmpeg is on your PATH."
            ) from exc
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"FFmpeg failed to convert audio: {exc}") from exc

        return wav_file