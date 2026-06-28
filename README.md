# Room Revenue Tracker

Mobile-responsive Django web application for managing revenue across a 42-room, 4-block residential property.

## Stack

- Python 3.12 / Django 5.x
- PostgreSQL
- Django REST Framework + JWT
- django-allauth
- Celery + Redis
- Tailwind CSS + HTMX (progressive enhancement)

## Quick Start

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Start services with Docker:

   ```bash
   docker compose up --build
   ```

3. Open the admin panel at [http://localhost:8000/admin/](http://localhost:8000/admin/)

## Development

Install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
```

Run migrations and tests:

```bash
python manage.py migrate
pytest
```

## Project Structure

```
property_tracker/     # Django project settings
apps/
  core/               # Shared mixins, dashboards
  accounts/           # Custom user, auth
  properties/         # Blocks, rooms, bed spaces
  tenants/            # Milestone 2
  revenue/            # Milestone 3
  utilities/          # Milestone 4
  maintenance/        # Milestone 5
  reports/            # Milestone 6
```

## Milestones

See `Docs/MVP_Milestone_Document.pdf` for the full MVP plan.

- **M1 (current):** Project bootstrap, auth, core models, CI/CD
- **M2:** Bed space management & tenant onboarding
- **M3:** Revenue ledger
- **M4:** Utilities subsystem
- **M5:** Maintenance triage
- **M6:** Dashboards & reports
- **M7:** QA, security & production deployment
