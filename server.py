import os
import uuid
from pathlib import Path
from typing import Dict

import google.generativeai as genai
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from speech_handler import SpeechRecognizer
from tts_engine import TextToSpeechEngine

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
TEMP_DIR = BASE_DIR / "temp_audio"
RESPONSES_DIR = BASE_DIR / "static" / "responses"
for directory in (TEMP_DIR, RESPONSES_DIR):
    directory.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing. Add it to your .env file.")

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

transcriber = SpeechRecognizer()
tts_engine = TextToSpeechEngine()

app = FastAPI(title="Jarvis AI Voice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


@app.get("/", include_in_schema=False)
async def serve_root():
    return FileResponse(BASE_DIR / "index.html")


@app.post("/api/interact")
async def interact(audio: UploadFile = File(...)) -> Dict[str, str]:
    session_id = uuid.uuid4().hex
    input_path = TEMP_DIR / f"{session_id}.webm"
    response_path = RESPONSES_DIR / f"{session_id}.wav"

    try:
        with input_path.open("wb") as buffer:
            buffer.write(await audio.read())

        transcription = await transcriber.transcribe(str(input_path))
        if not transcription:
            raise HTTPException(status_code=400, detail="Jarvis couldn’t hear anything. Try again?")

        prompt = (
            "You are Jarvis, a poised and pragmatic voice assistant. "
            "Respond succinctly with clarity and a dash of encouragement.\n\n"
            f"User said: {transcription}\n"
            "Jarvis replies:"
        )
        gemini_result = gemini_model.generate_content(prompt)
        ai_text = gemini_result.text.strip() if gemini_result.text else (
            "I’m here, though I’m not entirely sure how to respond to that yet."
        )

        await tts_engine.speak_to_file(ai_text, str(response_path))

        return JSONResponse(
            {
                "user_text": transcription,
                "ai_response": ai_text,
                "audio_url": f"/static/responses/{response_path.name}",
            }
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if input_path.exists():
            input_path.unlink(missing_ok=True)


@app.get("/api/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "components": {
            "speech_recognition": transcriber.ready,
            "gemini": True,
            "pyttsx3": tts_engine.ready,
        },
    }


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)