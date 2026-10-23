"""Deploy versiyasi: health javobida ko'rinadi (deploydan keyin nima ishlayotganini bilish)."""

import os

# Frontend `frontend/backend-revision.json` dagi `min` shu qiymatdan oshmasligi kerak (prod build
# backend'ning shu versiyasi chiqquncha kutadi). API shartnomasi frontend uchun muhim darajada
# o'zgarganda (yangi endpoint/maydon yangi frontend'siz ishlamasa) oshiring va frontend'dagini ham.
API_REVISION = 2

_COMMIT_VARS = ("RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT_SHA", "SOURCE_VERSION")


def commit_sha() -> str:
    """Qisqa commit (7 belgi); platforma bermasa `unknown`."""
    for name in _COMMIT_VARS:
        value = os.environ.get(name, "").strip()
        if value:
            return value[:7]
    return "unknown"


def version_info() -> dict:
    return {
        "commit": commit_sha(),
        "api_revision": API_REVISION,
        "environment": os.environ.get("RAILWAY_ENVIRONMENT_NAME", "").strip() or "local",
    }
