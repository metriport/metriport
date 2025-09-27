FROM python:3.13-slim

WORKDIR /app
COPY . /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "main.py"]
