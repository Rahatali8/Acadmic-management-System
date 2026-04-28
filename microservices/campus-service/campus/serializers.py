import json
from rest_framework import serializers
from .models import Campus


class CampusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campus
        fields = "__all__"

    def to_internal_value(self, data):
        # When sent as multipart/form-data, grades_data arrives as a JSON string.
        # Parse it back to a Python list so JSONField stores it correctly.
        if "grades_data" in data and isinstance(data.get("grades_data"), str):
            try:
                data = data.copy()
                data["grades_data"] = json.loads(data["grades_data"])
            except (json.JSONDecodeError, ValueError):
                pass
        return super().to_internal_value(data)
