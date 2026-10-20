from rest_framework import serializers

from .models import Kind, Status, SupportMessage

MIN_MESSAGE_LENGTH = 10
MAX_MESSAGE_LENGTH = 2000


class SupportCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=Kind.choices, default=Kind.QUESTION)
    message = serializers.CharField(
        min_length=MIN_MESSAGE_LENGTH, max_length=MAX_MESSAGE_LENGTH, trim_whitespace=True
    )
    page_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")
    topic = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    # Honeypot: haqiqiy foydalanuvchi ko'rmaydi va to'ldirmaydi; bot to'ldiradi.
    website = serializers.CharField(required=False, allow_blank=True, default="", write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user
        if not attrs["email"] and not user.is_authenticated:
            raise serializers.ValidationError({"email": "required"}, code="required")
        return attrs


class SupportReceivedSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class SupportMessageSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(choices=Kind.choices)
    status = serializers.ChoiceField(choices=Status.choices)

    class Meta:
        model = SupportMessage
        fields = ["id", "kind", "message", "topic", "page_url", "status", "created_at"]
        read_only_fields = fields
