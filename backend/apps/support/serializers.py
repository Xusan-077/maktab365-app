from rest_framework import serializers

from .models import Kind, Status, SupportMessage
from .quality import MIN_MESSAGE_LENGTH, is_meaningless

MAX_MESSAGE_LENGTH = 2000
MAX_PAGE = 100_000


class SupportCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    email = serializers.EmailField(max_length=254, required=False, allow_blank=True, default="")
    kind = serializers.ChoiceField(choices=Kind.choices, default=Kind.QUESTION)
    message = serializers.CharField(
        min_length=MIN_MESSAGE_LENGTH, max_length=MAX_MESSAGE_LENGTH, trim_whitespace=True
    )
    page_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")
    topic = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    # Kitob va bet ("Xato topdingizmi?"): berilmasa `topic` (kitob id) va `page_url` (`?page=`) dan.
    pdf_book = serializers.UUIDField(required=False, allow_null=True, default=None)
    page = serializers.IntegerField(
        required=False, allow_null=True, default=None, min_value=1, max_value=MAX_PAGE
    )
    # Honeypot: haqiqiy foydalanuvchi ko'rmaydi va to'ldirmaydi; bot to'ldiradi.
    website = serializers.CharField(required=False, allow_blank=True, default="", write_only=True)

    def validate_message(self, value):
        if is_meaningless(value):
            raise serializers.ValidationError("message_meaningless", code="message_meaningless")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        if not attrs["email"] and not user.is_authenticated:
            raise serializers.ValidationError({"email": "required"}, code="required")
        return attrs


class SupportReceivedSerializer(serializers.Serializer):
    ok = serializers.BooleanField()


class SupportAdminBookSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    slug = serializers.SlugField()
    grade = serializers.IntegerField()
    title = serializers.JSONField()


class SupportAdminSerializer(serializers.ModelSerializer):
    """Admin "Xabarlar": o'qish + `status` va `staff_note` ni o'zgartirish."""

    kind = serializers.ChoiceField(choices=Kind.choices, read_only=True)
    status = serializers.ChoiceField(choices=Status.choices)
    staff_note = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    pdf_book = SupportAdminBookSerializer(read_only=True, allow_null=True)
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = [
            "id",
            "kind",
            "message",
            "status",
            "staff_note",
            "name",
            "email",
            "user_email",
            "pdf_book",
            "page",
            "page_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "kind",
            "message",
            "name",
            "email",
            "user_email",
            "pdf_book",
            "page",
            "page_url",
            "created_at",
            "updated_at",
        ]

    def get_user_email(self, message) -> str | None:
        return message.user.email if message.user else None


class SupportBookCountSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.JSONField()
    grade = serializers.IntegerField()
    count = serializers.IntegerField()


class SupportSummarySerializer(serializers.Serializer):
    new = serializers.IntegerField(help_text="Yangi (ko'rilmagan) xabarlar soni — sidebar badge")
    books = SupportBookCountSerializer(many=True, help_text="Xabari bor kitoblar (filtr uchun)")


class SupportMessageSerializer(serializers.ModelSerializer):
    kind = serializers.ChoiceField(choices=Kind.choices)
    status = serializers.ChoiceField(choices=Status.choices)

    class Meta:
        model = SupportMessage
        fields = ["id", "kind", "message", "topic", "page_url", "status", "created_at"]
        read_only_fields = fields
