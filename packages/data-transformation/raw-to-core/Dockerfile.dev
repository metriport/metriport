FROM python:3.13-slim

WORKDIR /app
COPY . /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install dbt-core dbt-postgres
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
RUN dbt deps

ENV DBT_PROFILES_DIR=/app/profiles
ENV DBT_LOG_PATH=/app/logs

CMD ["python", "main.py"]
