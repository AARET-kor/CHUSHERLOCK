# Drop monitor as an always-on service (Railway, Fly.io, any Docker host).
# Settings come from environment variables; see README "서버에 올리기".
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CH_DATA_DIR=/data

WORKDIR /app
COPY chmonitor ./chmonitor
RUN mkdir -p /data

# --server: listens on $PORT, needs CH_DASHBOARD_PASSWORD, no desktop popups
CMD ["python", "-m", "chmonitor", "--server"]
