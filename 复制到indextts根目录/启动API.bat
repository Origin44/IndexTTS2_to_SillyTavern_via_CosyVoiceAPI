set HF_HOME=%~dp0checkpoints\
set XDG_CACHE_HOME=%~dp0checkpoints\
set HF_ENDPOINT=https://hf-mirror.com
.\env\python.exe API.py
pause