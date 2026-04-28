import os
from django.apps import AppConfig

class ClassesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'classes'
    path = os.path.dirname(os.path.abspath(__file__))
    
    def ready(self):
        import classes.signals