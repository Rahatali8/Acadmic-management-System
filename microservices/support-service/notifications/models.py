class _FakeQuerySet:
    def exists(self):
        return False

    def count(self):
        return 0

    def filter(self, *args, **kwargs):
        return self

    def all(self):
        return self

    def delete(self):
        return 0, {}

    def update(self, **kwargs):
        return 0


class _FakeManager:
    def filter(self, *args, **kwargs):
        return _FakeQuerySet()

    def all(self):
        return _FakeQuerySet()

    def create(self, *args, **kwargs):
        return None


class Notification:
    objects = _FakeManager()
