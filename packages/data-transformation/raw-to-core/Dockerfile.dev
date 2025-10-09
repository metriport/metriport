ARG py_version=3.12.11

FROM python:$py_version-slim-bullseye AS base

RUN apt-get update \
  && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends \
    build-essential=12.9 \
    ca-certificates=20210119 \
    git=1:2.30.2-1+deb11u2 \
    libpq-dev=13.22-0+deb11u1 \
    make=4.3-4.1 \
    openssh-client=1:8.4p1-5+deb11u3 \
    software-properties-common=0.96.20.2-2.1 \
  && apt-get clean \
  && rm -rf \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

ENV PYTHONIOENCODING=utf-8
ENV LANG=C.UTF-8

RUN python -m pip install --upgrade "pip==24.0" "setuptools==69.2.0" "wheel==0.43.0" --no-cache-dir

COPY . /usr/app/dbt/
WORKDIR /usr/app/dbt/

ARG commit_ref=main

FROM base AS dbt-core

RUN python -m pip install --no-cache-dir "dbt-core @ git+https://github.com/dbt-labs/dbt-core@${commit_ref}#subdirectory=core"

ARG commit_ref=main

FROM base AS dbt-postgres

RUN python -m pip install --no-cache-dir "dbt-adapters @ git+https://github.com/dbt-labs/dbt-adapters@${commit_ref}#subdirectory=dbt-adapters"
RUN python -m pip install --no-cache-dir "dbt-postgres @ git+https://github.com/dbt-labs/dbt-adapters@${commit_ref}#subdirectory=dbt-postgres"

RUN dbt deps

HEALTHCHECK CMD dbt --version // exit 1

CMD ["python", "main.py"]
