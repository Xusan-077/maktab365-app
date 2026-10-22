"""OpenAPI generatsiyasini barqaror qiladi.

drf-spectacular bir yo'l ichidagi metodlarni (get/patch/delete…) Python `set` tartibida beradi, u
jarayon boshiga o'zgaradi (`PYTHONHASHSEED`). Shuning uchun `make schema` har safar boshqacha
`openapi.yaml` yozardi; bu hook metodlarni qat'iy tartibga soladi.
"""

METHOD_ORDER = ("get", "put", "post", "patch", "delete", "options", "head", "trace")
_RANK = {method: index for index, method in enumerate(METHOD_ORDER)}


def sort_path_methods(result, generator, request, public):
    for path, item in result.get("paths", {}).items():
        # Yo'l darajasidagi kalitlar (parameters, summary) metodlardan oldin qoladi.
        extras = {key: value for key, value in item.items() if key not in _RANK}
        methods = sorted((key for key in item if key in _RANK), key=_RANK.__getitem__)
        result["paths"][path] = {**extras, **{method: item[method] for method in methods}}
    return result
