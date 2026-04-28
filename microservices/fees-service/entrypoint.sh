#!/bin/sh
set -e
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do sleep 1; done
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec gunicorn fees_service.wsgi:application --bind 0.0.0.0:8008 --workers 4 --worker-tmp-dir /dev/shm --timeout 120 --access-logfile - --error-logfile -
