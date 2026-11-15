FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    LAUNDRY_DATABASE=/app/instance/laundry.sqlite3 \
    LAUNDRY_UPLOAD_FOLDER=/app/instance/uploads

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/instance/uploads

VOLUME ["/app/instance"]
EXPOSE 8000
CMD ["waitress-serve", "--listen=0.0.0.0:8000", "app:app"]
