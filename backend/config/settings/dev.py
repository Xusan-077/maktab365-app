from .base import *  # noqa: F403
from .base import env

DEBUG = env.bool("DEBUG", default=True)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "[::1]", "backend"])
ENABLE_API_DOCS = True
# Dev: import qilingan draft kontent ham ko'rinadi (`unverified` bilan); env bilan o'chiriladi.
SHOW_DRAFTS_PUBLICLY = env.bool("SHOW_DRAFTS_PUBLICLY", default=True)
