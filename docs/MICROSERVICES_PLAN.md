# AMS — Microservices Architecture Plan
**Academic Management System → Microservices + Docker + Kubernetes**

---

## 1. Current Architecture (Kya Hai Abhi)

```
Browser / Mobile
      │
   Nginx (reverse proxy)
      │
  ┌───┴───────────────────┐
  │  Next.js Frontend     │  ← Port 3000
  └───────────────────────┘
      │ REST / GraphQL / WebSocket
  ┌───┴───────────────────────────────────┐
  │         Django Monolith               │  ← Port 8000 (Daphne ASGI)
  │  users | students | teachers          │
  │  coordinator | principals | campus    │
  │  classes | attendance | result        │
  │  fees | timetable | transfers         │
  │  notifications | requests | behaviour │
  │  form_builder | student_status        │
  └───────────────────────────────────────┘
      │                    │
  PostgreSQL (single DB)   Redis (cache + channels)
```

**Problems with Monolith:**
- Ek service fail → poora system down
- Sirf attendance scale karna ho → puri app scale karni parti hai
- Kuch bhi deploy karo → poora restart
- ZKTeco data loss risk agar backend crash kare

---

## 2. Target Architecture

```
Browser / Mobile / ZKTeco Device
          │
    ┌─────┴────────────────────────┐
    │   Kubernetes Ingress (nginx) │  ← 80 / 443 (SSL)
    └─────┬────────────────────────┘
          │
    ┌─────┴────────────────────────┐
    │       API Gateway            │  ← JWT verify | rate limit | routing
    └─┬──┬──┬──┬──┬──┬──┬──┬──┬──┘
      │  │  │  │  │  │  │  │  │
    [1] [2] [3] [4] [5] [6] [7] [8] ... (microservices)
          │
    ┌─────┴────────────────────────┐
    │    RabbitMQ (Message Bus)    │  ← inter-service async events
    └─────┬────────────────────────┘
          │
    PostgreSQL (per service DB) | Redis (shared) | MinIO (files)
```

---

## 3. Services — Complete Breakdown

### SERVICE 1: auth-service  [PRIORITY 1 — FIRST BANAO]
**Port:** 8001 | **DB:** auth_db

Kya aata hai:
- Login / Logout → users/views.py (UserLoginView)
- JWT token generate + refresh
- Password change + OTP verification
- Token version validation (session invalidation)
- Session management

Models: PasswordChangeOTP + User (auth fields only)
Why first: Baaki sab services ispe depend hain JWT validation ke liye

---

### SERVICE 2: org-service
**Port:** 8002 | **DB:** org_db

Kya aata hai:
- Organization CRUD → users/views.py
- Subscription Plans → users/views.py
- User management (add/edit/delete) → users/views.py
- Role Permissions (RolePermission model)
- Feature flags (enabled_features per org)
- Staff Management page (role switch)

Models: Organization, User, RolePermission, SubscriptionPlan

---

### SERVICE 3: campus-service
**Port:** 8003 | **DB:** campus_db

Kya aata hai:
- Campus CRUD → campus/
- Classroom Management → classes/
- Level Management → classes/
- Grade Management → classes/

Models: Campus, Class, Level, Grade

---

### SERVICE 4: staff-service
**Port:** 8004 | **DB:** staff_db

Kya aata hai:
- Teacher profiles + CRUD → teachers/ (559 lines models)
- Coordinator profiles → coordinator/ (426 lines models)
- Principal profiles → principals/ (232 lines models)
- Subject assignment → coordinator/
- Teacher attendance history

Models: Teacher, Coordinator, Principal, Subject

---

### SERVICE 5: student-service  [PRIORITY 1]
**Port:** 8005 | **DB:** student_db

Kya aata hai:
- Student profiles + CRUD → students/ (502 lines models)
- Bulk upload (CSV/Excel)
- Promotions (class upgrade)
- Leaving / termination certificates
- Student status → student_status/
- Behaviour tracking → behaviour/

Models: Student, StudentStatus, Behaviour

---

### SERVICE 6: attendance-service  [PRIORITY 1]
**Port:** 8006 | **DB:** attendance_db

Kya aata hai:
- Mark student attendance → attendance/views.py (3442 lines!)
- Attendance review + approval
- Attendance history + reports
- Staff attendance
- ZKTeco Push API → attendance/urls_zkteco.py
  (/iclock/cdata, /iclock/getrequest, /iclock/push)

Models: Attendance, StaffAttendance, ZKTecoDevice (649 lines models)
Special: ZKTeco endpoints directly route karo is service ko — device directly yahan push karega

---

### SERVICE 7: result-service  [PRIORITY 1]
**Port:** 8007 | **DB:** result_db

Kya aata hai:
- Create / edit results → result/ (298 lines models)
- Bulk import results (Excel)
- Result approval workflow (teacher → coordinator → principal)
- Report cards generation
- Class stats

Models: Result, SubjectMark, ExamType (1217 lines views)

---

### SERVICE 8: fees-service
**Port:** 8008 | **DB:** fees_db

Kya aata hai:
- Fee structures → fees/ (194 lines models)
- Fee types
- Generate fee challans (bulk + individual)
- Payment recording
- Pending payments list
- Bank accounts management
- Fee reports

Models: FeeStructure, FeeType, Payment, Challan, BankAccount

---

### SERVICE 9: timetable-service
**Port:** 8009 | **DB:** timetable_db

Kya aata hai:
- Timetable management → timetable/ (377 lines models)
- Shift timings
- Transfer management → transfers/ (827 lines models, 3998 lines views!)
- Transfer approval workflow

Models: Timetable, ShiftTiming, Transfer, TransferRequest

---

### SERVICE 10: notification-service
**Port:** 8010 | **DB:** notification_db

Kya aata hai:
- Real-time WebSocket notifications → notifications/ (Django Channels)
- Email notifications → services/email_notification_service.py
- In-app notifications
- Cross-service event handling (RabbitMQ consumer)

Models: Notification (37 lines — simple)
Special: Ye service RabbitMQ se events sunegi aur notifications bhejegi

---

### SERVICE 11: support-service
**Port:** 8011 | **DB:** support_db

Kya aata hai:
- Requests / complaints → requests/ (183 lines models, 609 lines views)
- Form builder → form_builder/ (29 lines models)
- Request approval workflow

Models: Request, FormTemplate, FormSubmission

---

### SERVICE 12: api-gateway
**Port:** 80 / 443

Nginx-based:
- /api/auth/*        → auth-service:8001
- /api/org/*         → org-service:8002
- /api/campus/*      → campus-service:8003
- /api/staff/*       → staff-service:8004
- /api/students/*    → student-service:8005
- /api/attendance/*  → attendance-service:8006
- /api/result/*      → result-service:8007
- /api/fees/*        → fees-service:8008
- /api/timetable/*   → timetable-service:8009
- /api/notifications/* → notification-service:8010
- /api/support/*     → support-service:8011
- /iclock/*          → attendance-service:8006 (ZKTeco)
- /*                 → frontend:3000

JWT validation API Gateway level par — baaki services trusted internal calls karengi

---

## 4. Inter-Service Communication

### Synchronous (direct REST calls)
```
auth-service       → org-service      (user verify)
student-service    → campus-service   (class info fetch)
result-service     → student-service  (student validate)
attendance-service → staff-service    (teacher info)
fees-service       → student-service  (student fee data)
```

### Asynchronous Events (RabbitMQ)
```
Event: student.enrolled
  → notification-service (welcome email)

Event: attendance.marked_absent
  → notification-service (parent ko alert)

Event: result.approved
  → notification-service (result published notification)
  → student-service     (student record update)

Event: fees.due_reminder
  → notification-service (email reminder)

Event: transfer.approved
  → student-service     (update student campus)
  → notification-service (confirmation send)
```

---

## 5. Migration Strategy — Strangler Fig Pattern

Rule: Current system chalte hue ek ek service nikalni hai. ZERO DOWNTIME.
Current docker-compose.yml already hai — usi se shuru karo.

### PHASE 1 — Infrastructure Setup (Week 1-2)
- [ ] Kubernetes cluster setup
      Local dev: minikube ya k3s
      Production: DigitalOcean K8s ya GKE (Google)
- [ ] Helm charts structure banana
- [ ] PostgreSQL — separate DB per service plan karna
- [ ] RabbitMQ deploy karna
- [ ] MinIO setup (media files ke liye — replace local media/ folder)
- [ ] API Gateway nginx config likhna
- [ ] GitHub Actions CI/CD pipeline
      (push → Docker build → push to registry → kubectl apply)
- [ ] Prometheus + Grafana monitoring setup

### PHASE 2 — Auth Service Extract (Week 3) [FIRST]
- [ ] auth-service/ Django project banana (separate folder)
- [ ] Login, JWT, OTP views copy + refactor
- [ ] auth_db banana (migrate auth models)
- [ ] API Gateway mein /api/auth/* → auth-service route karna
- [ ] Current monolith JWT validation → auth-service pe delegate karna
- [ ] Test: login → token milta hai → token valid hai

### PHASE 3 — Attendance Service (Week 4) [HIGH PRIORITY]
- [ ] attendance-service/ banana
- [ ] attendance_db banana (migrate)
- [ ] ZKTeco endpoints move karna (CRITICAL — device registered hai)
- [ ] RabbitMQ: attendance.marked event publish karna
- [ ] notification-service: event consume karna
- [ ] API Gateway: /api/attendance/* + /iclock/* → attendance-service

### PHASE 4 — Result Service (Week 5) [HIGH PRIORITY]
- [ ] result-service/ banana
- [ ] result_db banana
- [ ] Result approval workflow move karna
- [ ] RabbitMQ: result.approved event

### PHASE 5 — Student + Staff + Campus (Week 6-7)
- [ ] student-service/ banana
- [ ] staff-service/ banana (teachers + coordinators + principals)
- [ ] campus-service/ banana

### PHASE 6 — Fees + Timetable + Support (Week 8)
- [ ] fees-service/
- [ ] timetable-service/ (transfers bhi issi mein)
- [ ] support-service/ (requests + form_builder)

### PHASE 7 — Notification + Org Service (Week 9)
- [ ] notification-service/ (WebSocket careful — Django Channels)
- [ ] org-service/ (LAST — most critical shared data)

### PHASE 8 — K8s Production Hardening (Week 10-11)
- [ ] HorizontalPodAutoscaler (HPA) per service
- [ ] Load testing (k6 tool se)
- [ ] Grafana dashboards
- [ ] Alerts (Slack pe)
- [ ] Backup strategy (Velero)
- [ ] SSL (Cert-Manager + Let's Encrypt)

---

## 6. LMS + VMS Integration Plan

### Concept (Same as Feature Flags — Jo Hamne Banaya)
```
Organization create/edit page:
  [x] AMS — Academic Management System   (hamesha included)
  [ ] LMS — Learning Management System   (optional checkbox)
  [ ] VMS — Visitor Management System    (optional checkbox)

Check karo → org ko us system ka access milta hai
Uncheck karo → access revoke
```

### Architecture
```
browser
   │
API Gateway (shared)
   ├── /ams/* → AMS K8s cluster  (current project)
   ├── /lms/* → LMS K8s cluster  (alag project)
   └── /vms/* → VMS K8s cluster  (alag project)
```

### Shared Between All 3 Systems
- auth-service → Single Sign-On (ek login, teeno systems mein access)
- org-service  → Same organization record
- notification-service → Cross-system notifications

### LMS Services (Future)
- course-service (courses, lessons, videos)
- quiz-service (quizzes, assignments, grades)
- library-service (books, resources)
- lms-frontend (separate Next.js)

### VMS Services (Future)
- visitor-service (visitor registration, appointments)
- entry-service (entry/exit logs, badge printing)
- vms-frontend (separate Next.js)

### Frontend
```
Option A — Subdomains:
  ams.newton.edu  → AMS frontend
  lms.newton.edu  → LMS frontend
  vms.newton.edu  → VMS frontend

Option B — Unified Portal:
  app.newton.edu
    /ams → AMS (if enabled)
    /lms → LMS (if enabled)
    /vms → VMS (if enabled)
```

---

## 7. Kubernetes File Structure

```
k8s/
├── namespaces/
│   ├── production.yaml
│   └── staging.yaml
├── infrastructure/
│   ├── postgres/        (StatefulSet)
│   ├── redis/           (StatefulSet)
│   ├── rabbitmq/        (StatefulSet)
│   ├── minio/           (StatefulSet)
│   └── nginx-ingress/
├── services/
│   ├── auth-service/
│   │   ├── deployment.yaml     (replicas: 3)
│   │   ├── service.yaml        (ClusterIP)
│   │   ├── hpa.yaml            (min:2 max:10)
│   │   └── configmap.yaml
│   ├── attendance-service/     (same structure)
│   ├── result-service/
│   ├── student-service/
│   └── ... (baaki sab)
├── gateway/
│   └── nginx-ingress.yaml
└── monitoring/
    ├── prometheus/
    └── grafana/
```

---

## 8. Shared Internal Library

```
ams-shared/  (internal Python package)
├── jwt/
│   └── validator.py      ← har service mein JWT verify karega
├── permissions/
│   └── base.py           ← base permission classes
├── models/
│   └── base.py           ← BaseModel (timestamps, org_id)
└── events/
    └── publisher.py      ← RabbitMQ event publish karna
```

Har service mein install: `pip install ams-shared`

---

## 9. Performance Targets

| Metric | Monolith (Now) | Microservices (Target) |
|---|---|---|
| Login latency | ~300-500ms | <100ms |
| Data fetch | ~200-400ms | <80ms |
| Attendance mark | ~500ms | <150ms |
| Concurrent users | 50-100 | 500+ per service |
| Deploy downtime | 30-60 seconds | 0 (rolling update) |
| ZKTeco data loss | Risk exists | Zero (dedicated service) |
| Scale out time | Full restart | ~30s new pod |
| DB connection limit | Shared pool | Per-service pool |

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| Backend Services | Django + DRF (same, just split) |
| ASGI Server | Daphne (notification-service) / Gunicorn (rest) |
| API Gateway | Nginx + Kong OR Traefik |
| Containers | Docker |
| Orchestration | Kubernetes (k3s local / GKE or DigitalOcean prod) |
| Database | PostgreSQL 15 (separate DB per service) |
| Cache | Redis 7 (shared) |
| Message Queue | RabbitMQ (or Kafka for very high volume) |
| File Storage | MinIO (S3-compatible, replaces local media/) |
| Monitoring | Prometheus + Grafana |
| Logging | Loki + Grafana |
| CI/CD | GitHub Actions → Docker Hub → kubectl |
| SSL | Cert-Manager + Let's Encrypt |
| Secrets | Kubernetes Secrets (or Vault later) |

---

## 11. Implementation Order (Final)

```
STEP 1:  Infrastructure (K8s + DBs + Gateway + RabbitMQ)
STEP 2:  auth-service          [FIRST — everything depends on it]
STEP 3:  attendance-service    [HIGH — ZKTeco + most used]
STEP 4:  result-service        [HIGH — teachers use daily]
STEP 5:  student-service
STEP 6:  staff-service
STEP 7:  campus-service
STEP 8:  fees-service
STEP 9:  timetable-service     [includes transfers]
STEP 10: support-service
STEP 11: notification-service  [WebSocket — careful]
STEP 12: org-service           [LAST — most shared data]
STEP 13: K8s hardening (HPA, monitoring, alerts)
STEP 14: LMS integration
STEP 15: VMS integration
```

---

*Plan Version: 1.0 | Date: 2026-04-25*
*Project: Newton AMS Microservices Conversion*
