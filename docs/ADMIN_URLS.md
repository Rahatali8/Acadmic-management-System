# Django Admin URLs

## Local Development

Direct service ports (all exposed in docker-compose):

| Service            | Admin URL                          | Port |
|--------------------|------------------------------------|------|
| Auth               | http://localhost:8001/admin/       | 8001 |
| Organization       | http://localhost:8002/admin/       | 8002 |
| Campus             | http://localhost:8003/admin/       | 8003 |
| Staff              | http://localhost:8004/admin/       | 8004 |
| Student            | http://localhost:8005/admin/       | 8005 |
| Attendance         | http://localhost:8006/admin/       | 8006 |
| Result             | http://localhost:8007/admin/       | 8007 |
| Fees               | http://localhost:8008/admin/       | 8008 |
| Timetable          | http://localhost:8009/admin/       | 8009 |
| Notification       | http://localhost:8010/admin/       | 8010 |
| Support            | http://localhost:8011/admin/       | 8011 |

---

## Production (sms.idaraalkhair.sbs)

Production ports are NOT publicly exposed — admin is accessed via SSH tunnel.

### Step 1 — Open tunnel on your local machine

```bash
# Replace user@server with your actual SSH user and server IP
ssh -L 8001:localhost:8001 \
    -L 8002:localhost:8002 \
    -L 8003:localhost:8003 \
    -L 8004:localhost:8004 \
    -L 8005:localhost:8005 \
    -L 8006:localhost:8006 \
    -L 8007:localhost:8007 \
    -L 8008:localhost:8008 \
    -L 8009:localhost:8009 \
    -L 8010:localhost:8010 \
    -L 8011:localhost:8011 \
    user@sms.idaraalkhair.sbs -N
```

### Step 2 — Open in browser (same URLs as local)

| Service            | Admin URL                          |
|--------------------|------------------------------------|
| Auth               | http://localhost:8001/admin/       |
| Organization       | http://localhost:8002/admin/       |
| Campus             | http://localhost:8003/admin/       |
| Staff              | http://localhost:8004/admin/       |
| Student            | http://localhost:8005/admin/       |
| Attendance         | http://localhost:8006/admin/       |
| Result             | http://localhost:8007/admin/       |
| Fees               | http://localhost:8008/admin/       |
| Timetable          | http://localhost:8009/admin/       |
| Notification       | http://localhost:8010/admin/       |
| Support            | http://localhost:8011/admin/       |

---

## Create superuser for any service

```bash
# Local
docker exec -it ams_auth python manage.py createsuperuser

# Replace ams_auth with any container name:
# ams_org | ams_campus | ams_staff | ams_student
# ams_attendance | ams_result | ams_fees
# ams_timetable | ams_notification | ams_support
```
