from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers


class LocalizedTextSerializer(serializers.Serializer):
    """Ko'p tilli matn: API tilni tanlamaydi, klient `getLocalized` bilan tanlaydi."""

    uz = serializers.CharField()
    ru = serializers.CharField(required=False)
    en = serializers.CharField(required=False)


@extend_schema_field(LocalizedTextSerializer)
class LocalizedField(serializers.Field):
    """`LocalizedTextField` qiymatini o'zgartirmay qaytaradi."""

    def to_representation(self, value):
        return value


class SubjectSerializer(serializers.Serializer):
    slug = serializers.SlugField()
    title = LocalizedField()
    icon = serializers.CharField()
    order = serializers.IntegerField()
    group = serializers.CharField()
    grades = serializers.ListField(child=serializers.IntegerField())
    books_count = serializers.IntegerField()
