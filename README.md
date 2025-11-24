# LR-Jarvis
This conversational AI platform was created by Lakshya Raj.

# Make file structure with this
mkdir Jarvis

cd Jarvis

type nul > requirements.txt

type nul > .env

type nul > server.py

type nul > speech_handler.py

type nul > tts_handler.py

type nul > index.html

type nul > test.py

mkdir static

cd static

type nul > style.css

type nul > script.js
# In the powershell you going to get error but don't care about it because your file structure is made 

# Code
python -m venv venv

venv\Scripts\activate.ps1     
# if this code giving error then try this   .\venv\Scripts\activate.ps1
pip install -r requirements.txt

uvicorn server:app --reload
