from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.learning.serializers import (
    BookmarkSerializer,
    PdfBookmarkSerializer,
    PdfProgressSerializer,
    StudyGoalSerializer,
    TopicProgressSerializer,
)

from . import services
from .models import Locale, Profile, Role, User

MAX_LIST = 30
ONBOARDING_ROLES = [Role.STUDENT, Role.TEACHER]


class IdListField(serializers.ListField):
    """Fan id'lari (slug) ro'yxati: dublikatsiz, cheklangan uzunlikda."""

    def __init__(self, **kwargs):
        kwargs.setdefault("child", serializers.CharField(max_length=64))
        kwargs.setdefault("max_length", MAX_LIST)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return services.normalize_ids(super().to_internal_value(data))


class GradeListField(serializers.ListField):
    def __init__(self, **kwargs):
        kwargs.setdefault("child", serializers.IntegerField(min_value=1, max_value=11))
        kwargs.setdefault("max_length", 11)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return sorted(services.normalize_ids(super().to_internal_value(data)))


class ProfileSerializer(serializers.ModelSerializer):
    # JSONField'lar sxemada `unknown` bo'lmasligi uchun aniq tip bilan e'lon qilinadi.
    subjects = serializers.ListField(child=serializers.CharField(), read_only=True)
    grades = serializers.ListField(child=serializers.IntegerField(), read_only=True)

    class Meta:
        model = Profile
        fields = [
            "display_name",
            "avatar_url",
            "locale",
            "grade",
            "subjects",
            "grades",
            "onboarded_at",
        ]
        read_only_fields = fields


class MeSerializer(serializers.ModelSerializer):
    email_verified = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "email_verified", "role", "date_joined", "profile"]
        read_only_fields = fields

    def get_email_verified(self, user) -> bool:
        return user.email_verified_at is not None

    @extend_schema_field(ProfileSerializer)
    def get_profile(self, user) -> dict:
        return ProfileSerializer(services.get_profile(user)).data


class ProfileUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=60, required=False)
    avatar_url = serializers.URLField(max_length=500, required=False, allow_blank=True)
    locale = serializers.ChoiceField(choices=Locale.choices, required=False)
    grade = serializers.IntegerField(min_value=1, max_value=11, required=False, allow_null=True)
    subjects = IdListField(required=False)
    grades = GradeListField(required=False)


class OnboardingSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ONBOARDING_ROLES)
    display_name = serializers.CharField(max_length=60)
    locale = serializers.ChoiceField(choices=Locale.choices, required=False)
    grade = serializers.IntegerField(min_value=1, max_value=11, required=False)
    subjects = IdListField(required=False)
    grades = GradeListField(required=False)

    def validate(self, attrs):
        if attrs["role"] == Role.STUDENT:
            if "grade" not in attrs:
                raise serializers.ValidationError({"grade": "This field is required."})
        else:
            for field in ("subjects", "grades"):
                if not attrs.get(field):
                    raise serializers.ValidationError({field: "This field is required."})
        return attrs


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)


class ExportIdentitySerializer(serializers.Serializer):
    provider = serializers.CharField()
    provider_uid = serializers.CharField()
    email = serializers.CharField(allow_blank=True)
    verified = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class ExportEventSerializer(serializers.Serializer):
    type = serializers.CharField()
    ip = serializers.CharField(allow_null=True)
    user_agent = serializers.CharField(allow_blank=True)
    meta = serializers.DictField()
    created_at = serializers.DateTimeField()


class ExportUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField(allow_null=True)
    email_verified_at = serializers.DateTimeField(allow_null=True)
    role = serializers.CharField()
    date_joined = serializers.DateTimeField()
    last_login = serializers.DateTimeField(allow_null=True)


class ExportLearningSerializer(serializers.Serializer):
    progress = TopicProgressSerializer(many=True)
    bookmarks = BookmarkSerializer(many=True)
    goals = StudyGoalSerializer(many=True)
    pdf_progress = PdfProgressSerializer(many=True)
    pdf_bookmarks = PdfBookmarkSerializer(many=True)


class ExportSerializer(serializers.Serializer):
    exported_at = serializers.DateTimeField()
    user = ExportUserSerializer()
    profile = ProfileSerializer()
    identities = ExportIdentitySerializer(many=True)
    auth_events = ExportEventSerializer(many=True)
    learning = ExportLearningSerializer()
