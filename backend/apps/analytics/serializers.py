from rest_framework import serializers

from apps.content.serializers import LocalizedField


class StatEventSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["open", "page"])
    page = serializers.IntegerField(required=False, min_value=1, max_value=100000)

    def validate(self, attrs):
        if attrs["kind"] == "page" and "page" not in attrs:
            raise serializers.ValidationError({"page": ["required"]})
        return attrs


class StatTotalsSerializer(serializers.Serializer):
    opens = serializers.IntegerField()
    downloads = serializers.IntegerField()


class StatBookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.CharField()
    grade = serializers.IntegerField()
    title = LocalizedField()
    opens = serializers.IntegerField()
    downloads = serializers.IntegerField()


class StatDaySerializer(serializers.Serializer):
    day = serializers.DateField()
    opens = serializers.IntegerField()
    downloads = serializers.IntegerField()


class StatPageSerializer(serializers.Serializer):
    book_id = serializers.UUIDField()
    slug = serializers.CharField()
    grade = serializers.IntegerField()
    title = LocalizedField()
    page = serializers.IntegerField()
    views = serializers.IntegerField()


class StatsSummarySerializer(serializers.Serializer):
    days = serializers.IntegerField()
    totals = StatTotalsSerializer()
    books = StatBookSerializer(many=True)
    daily = StatDaySerializer(many=True)
    top_pages = StatPageSerializer(many=True)
