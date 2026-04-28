# Microservices Fix Notes

## Root Cause
Monolith se microservices split ke baad, sab services ke `models.py` mein
`from users.managers import OrganizationManager` import tha, lekin `users` app
sirf `auth-service` aur `org-service` mein thi. Baaki 9 services crash ho rahi
thin on startup.

---

## Changes Made

### 1. org-service — URL typo fix
**File:** `microservices/org-service/org_service/urls.py`
- `include("users.org_urls")` → `include("users.urls")`

---

### 2. staff-service + student-service — Missing dependency
**File:** `microservices/staff-service/requirements.txt`
**File:** `microservices/student-service/requirements.txt`
- Added `django-cleanup` (was in INSTALLED_APPS but not in requirements)

---

### 3. Dockerfiles — Copy shared apps
Each service's Dockerfile now copies needed apps from other services into /app/.
This gives each service the models it depends on via FK references.

| Service | Copied Apps |
|---------|------------|
| campus-service | users (auth), coordinator (staff), teachers (staff) |
| staff-service | users (auth), campus (campus), classes (campus), students (student) |
| student-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff) |
| notification-service | users (auth), campus (campus) |
| result-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff), principals (staff), students (student) |
| attendance-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff), students (student) |
| fees-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff), students (student) |
| timetable-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff), students (student) |
| support-service | users (auth), campus (campus), classes (campus), coordinator (staff), teachers (staff), principals (staff) |

**Why coordinator + teachers together?**
- `classes/migrations/0002_initial.py` depends on `teachers/0001_initial`
- `teachers/migrations/0001_initial.py` depends on `coordinator/0001_initial`
So both are required whenever classes is needed.

---

### 4. settings.py — INSTALLED_APPS + AUTH_USER_MODEL + Middleware
Added to each of the 9 services' settings.py:

```python
AUTH_USER_MODEL = "users.User"
```

Added to INSTALLED_APPS (per service, see table above).

Added to MIDDLEWARE (after AuthenticationMiddleware):
```python
"users.middleware.OrganizationMiddleware",
```

---

## After Making These Changes

**Rebuild all affected services:**
```bash
docker compose build campus-service staff-service student-service \
    notification-service result-service attendance-service \
    fees-service timetable-service support-service org-service

docker compose up -d --force-recreate campus-service staff-service \
    student-service notification-service result-service attendance-service \
    fees-service timetable-service support-service org-service
```

**Databases are fresh** (all empty) — migrations will run from scratch on first start.

---

## Migration Dependency Order (resolved automatically by Django)
```
campus/0001 → users/0001 → campus/0002
classes/0001 → coordinator/0001 → teachers/0001 → classes/0002
students/0001 → students/0002 (needs campus/0002 + classes/0002)
```

---

### 5. nginx — CORS headers on 502/503/504 error responses

**Files:** `nginx/nginx.conf`, `nginx/nginx.prod.conf`

**Problem:** `add_header ... always` at server block level does NOT add CORS headers
to nginx-generated error pages (e.g. when a backend container is down and nginx returns 502).
This caused the browser to block the error response with a CORS policy failure, hiding the
real error from the frontend.

**Fix:** Added `error_page 502 503 504 = @backend_error;` and a named location
`@backend_error` that explicitly sets all CORS headers and returns 502.

```nginx
error_page 502 503 504 = @backend_error;
location @backend_error {
    add_header 'Access-Control-Allow-Origin'  $http_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true'   always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, Accept, X-Requested-With' always;
    return 502;
}
```

The server-level `add_header` lines are kept for regular proxied responses.
The named location handles only nginx-generated errors.

**After applying:** Reload nginx inside the container:
```bash
docker compose exec nginx nginx -s reload
```

---

## Known Issues (to fix later)
- `OrganizationManager` uses thread-local user context (set by OrganizationMiddleware).
  Services use `ServiceJWTAuthentication` (stateless), so OrganizationMiddleware cannot
  set the user context from JWT (because it does a DB lookup, not JWT decode).
  Result: `Model.objects.all()` may return empty queryset for non-superadmin users.
  Fix: Replace `OrganizationManager` with `models.Manager()` in all non-auth services
  and filter by `request.user.org_id` in views instead.
