FROM python:3.11-slim

WORKDIR /app

# Copiar dependencias primero (cache de Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

EXPOSE 5000

CMD ["python", "app.py"]

