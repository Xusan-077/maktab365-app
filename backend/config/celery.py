import os

from celery import Celery
from celery.signals import worker_ready

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("maktab365")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@worker_ready.connect
def report_worker_setup(sender=None, **_):
    """Worker ishga tushganda jurnalga: qaysi saqlash va vazifalar bilan ishlayapti.

    Backend va worker alohida xizmat (disk umumiy emas): ikkalasida bir xil S3/R2 env bo'lmasa,
    worker backend yuklagan PDF'ni topa olmaydi. Shuni birinchi qatordayoq ko'rish uchun.
    """
    import structlog
    from django.conf import settings
    from django.core.files.storage import storages

    logger = structlog.get_logger("celery.setup")
    default_backend = type(storages["default"]).__name__
    covers_backend = type(storages["covers"]).__name__
    registered = sorted(name for name in app.tasks if name.startswith("apps."))
    logger.info(
        "worker_setup",
        default_storage=default_backend,
        covers_storage=covers_backend,
        broker=str(app.conf.broker_url).rsplit("@", 1)[-1],
        tasks=registered,
    )
    if not settings.DEBUG and "FileSystem" in default_backend:
        logger.error(
            "worker_local_storage",
            hint="AWS_STORAGE_BUCKET_NAME bo'sh: worker backend yuklagan fayllarni ko'ra olmaydi",
        )
