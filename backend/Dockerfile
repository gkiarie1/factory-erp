FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home app
COPY --chown=app:app . .
USER app
EXPOSE 5000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:app"]
