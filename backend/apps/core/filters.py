from rest_framework.filters import BaseFilterBackend, OrderingFilter, SearchFilter


class DefaultFilterBackend(BaseFilterBackend):
    """`?search=` (view.search_fields) va `?ordering=` (view.ordering_fields) birga."""

    backends = (SearchFilter, OrderingFilter)

    def filter_queryset(self, request, queryset, view):
        for backend in self.backends:
            queryset = backend().filter_queryset(request, queryset, view)
        return queryset

    def get_schema_operation_parameters(self, view):
        params = []
        for backend in self.backends:
            params.extend(backend().get_schema_operation_parameters(view))
        return params
