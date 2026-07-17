FROM python:3.12-slim

# Dépendances système du navigateur Firefox/Camoufox (headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 libx11-xcb1 libasound2 libdbus-glib-1-2 libxtst6 \
    libxrandr2 libpci3 libegl1 libxcomposite1 libxdamage1 libxfixes3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Télécharge le navigateur Camoufox dans l'image
RUN python -m camoufox fetch

COPY main.py .

EXPOSE 8765
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8765"]
