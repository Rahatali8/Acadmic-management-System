.PHONY: up down build logs ps restart pull-images

# ─── Local Dev ────────────────────────────────────────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

build-no-cache:
	docker compose build --no-cache

logs:
	docker compose logs -f

ps:
	docker compose ps

restart:
	docker compose restart

# ─── Individual Service Controls ─────────────────────────────────────────────

auth:
	docker compose up -d auth-service

attendance:
	docker compose up -d attendance-service

result:
	docker compose up -d result-service

student:
	docker compose up -d student-service

# ─── Database Migrations (run against a specific service) ────────────────────

migrate-auth:
	docker compose exec auth-service python manage.py migrate

migrate-campus:
	docker compose exec campus-service python manage.py migrate

migrate-staff:
	docker compose exec staff-service python manage.py migrate

migrate-student:
	docker compose exec student-service python manage.py migrate

migrate-attendance:
	docker compose exec attendance-service python manage.py migrate

migrate-result:
	docker compose exec result-service python manage.py migrate

migrate-fees:
	docker compose exec fees-service python manage.py migrate

migrate-timetable:
	docker compose exec timetable-service python manage.py migrate

migrate-notification:
	docker compose exec notification-service python manage.py migrate

migrate-support:
	docker compose exec support-service python manage.py migrate

migrate-all: migrate-auth migrate-campus migrate-staff migrate-student \
	migrate-attendance migrate-result migrate-fees \
	migrate-timetable migrate-notification migrate-support

# ─── Shell Access ─────────────────────────────────────────────────────────────

shell-auth:
	docker compose exec auth-service python manage.py shell

shell-attendance:
	docker compose exec attendance-service python manage.py shell

# ─── Kubernetes ───────────────────────────────────────────────────────────────

k8s-apply-infra:
	kubectl apply -f k8s/namespaces/
	kubectl apply -f k8s/infrastructure/redis/
	kubectl apply -f k8s/infrastructure/rabbitmq/
	kubectl apply -f k8s/infrastructure/minio/

k8s-apply-services:
	for svc in auth-service org-service campus-service staff-service student-service \
		attendance-service result-service fees-service timetable-service \
		notification-service support-service; do \
		kubectl apply -f k8s/services/$$svc/; \
	done

k8s-apply-gateway:
	kubectl apply -f k8s/gateway/

k8s-apply-monitoring:
	kubectl apply -f k8s/monitoring/prometheus/
	kubectl apply -f k8s/monitoring/grafana/

k8s-apply-all: k8s-apply-infra k8s-apply-services k8s-apply-gateway k8s-apply-monitoring

k8s-status:
	kubectl get pods -n ams-production

k8s-logs-auth:
	kubectl logs -f deployment/auth-service -n ams-production

k8s-rollout-status:
	kubectl rollout status deployment -n ams-production
