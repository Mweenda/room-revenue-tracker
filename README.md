# Room Revenue Tracker

Mobile-responsive Django web application for managing revenue across a 42-room, 4-block residential property (BBH, NWG, ANX, CRV).

## Stack

- Python 3.12 / Django 5.x
- PostgreSQL
- Django REST Framework + JWT
- django-allauth, django-axes, django-csp, django-ratelimit
- Celery + Redis
- Tailwind CSS + HTMX
- Optional S3 storage via django-storages

## Quick Start

```bash
cp .env.example .env
docker compose up --build
python manage.py seed_property
```

Admin: [http://localhost:8000/admin/](http://localhost:8000/admin/)

## Development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
python manage.py migrate
python manage.py seed_property
pytest
```

## MVP Milestones

| Milestone | Status |
|-----------|--------|
| M1 — Project bootstrap | Done |
| M2 — Bed space & tenant onboarding | Done |
| M3 — Revenue ledger & verification | Done |
| M4 — Utilities subsystem | Done |
| M5 — Maintenance triage | Done |
| M6 — Dashboards & reports | Done |
| M7 — QA, security & production deploy | Done |

See `Docs/MVP_Milestone_Document.pdf` for full acceptance criteria.

## Key URLs

| Role | URL |
|------|-----|
| Owner dashboard | `/dashboard/owner/` |
| Occupancy grid | `/properties/occupancy/` |
| Tenant onboarding | `/tenants/onboard/` |
| Tenant portal | `/tenants/portal/` |
| Submit payment | `/revenue/submit/` |
| Pending verification | `/revenue/pending/` |
| Utilities portal | `/utilities/portal/` |
| Report maintenance | `/maintenance/report/` |
| CSV exports | `/reports/` |
| Health check | `/health/` |

## Production

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

See `Docs/DEPLOYMENT_RUNBOOK.md` for deploy, rollback, and backup steps.
