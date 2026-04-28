# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY microservices/ams-shared/ /app/ams-shared/
RUN pip install --no-cache-dir /app/ams-shared

COPY microservices/support-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup --no-create-home appuser

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

WORKDIR /app
COPY microservices/support-service/ /app/
COPY microservices/auth-service/users/ /app/users/
COPY microservices/auth-service/services/ /app/services/
COPY microservices/auth-service/utils/ /app/utils/
COPY microservices/campus-service/campus/ /app/campus/
COPY microservices/campus-service/classes/ /app/classes/
COPY microservices/staff-service/coordinator/ /app/coordinator/
COPY microservices/staff-service/teachers/ /app/teachers/
COPY microservices/staff-service/principals/ /app/principals/
RUN chmod +x /app/entrypoint.sh \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8011
ENTRYPOINT ["/app/entrypoint.sh"]
