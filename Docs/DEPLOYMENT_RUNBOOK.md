# Deployment Runbook — Room Revenue Tracker

## Environments

- **Development:** `docker compose up --build`
- **Production-like:** `docker compose -f docker-compose.prod.yml up --build -d`

## Deploy

1. Set production secrets via your host secrets manager (never commit `.env`).
2. Build and start:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

3. Run migrations (entrypoint does this for `web`; verify):

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py migrate
docker compose -f docker-compose.prod.yml exec web python manage.py seed_property
```

4. Health check: `curl -f http://localhost/health/`

## Rollback

1. Redeploy the previous image tag.
2. If a migration must be reversed, run `python manage.py migrate <app> <previous>` carefully after restoring a DB snapshot.

## Backups

- Schedule daily PostgreSQL dumps (`pg_dump`) from the managed database.
- Retain at least 7 daily backups.

## Monitoring

- Sentry captures application exceptions when `SENTRY_DSN` is set.
- Celery worker + beat handle payment reminders.
