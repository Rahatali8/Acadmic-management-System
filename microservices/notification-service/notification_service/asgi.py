import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "notification_service.settings")

from django.core.asgi import get_asgi_application

# Must initialize Django app registry before importing anything that uses models
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import notifications.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(notifications.routing.websocket_urlpatterns)
    ),
})
