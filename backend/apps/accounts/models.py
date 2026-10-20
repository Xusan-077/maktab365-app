from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

from apps.core.models import SoftDeleteModel, UUIDModel


class Role(models.TextChoices):
    STUDENT = "student", "Student"
    TEACHER = "teacher", "Teacher"
    EDITOR = "editor", "Editor"
    ADMIN = "admin", "Admin"


class Locale(models.TextChoices):
    UZ = "uz", "Uzbek (Latin)"
    UZ_CYRL = "uz-Cyrl", "Uzbek (Cyrillic)"
    RU = "ru", "Russian"
    EN = "en", "English"


class Provider(models.TextChoices):
    PASSWORD = "password", "Password"
    GOOGLE = "google", "Google"
    TELEGRAM = "telegram", "Telegram"
    EMAIL_OTP = "email_otp", "Email OTP"


class UserManager(BaseUserManager):
    """Default manager: o'chirilgan (anonimlashtirilgan) akkauntlarni ko'rsatmaydi."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def get_by_natural_key(self, username):
        """Admin kirishi uchun: email (katta-kichik harfsiz) yoki id bo'yicha."""
        if "@" in str(username):
            return self.get(email__iexact=str(username).strip())
        return self.get(pk=username)

    def _create(self, email, password, **extra):
        email = self.normalize_email(email) if email else None
        user = self.model(email=email, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email=None, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", Role.ADMIN)
        return self._create(email, password, **extra)


class User(UUIDModel, SoftDeleteModel, AbstractBaseUser, PermissionsMixin):
    # NULL (bo'sh satr emas): Telegram orqali kirganda email bo'lmasligi mumkin.
    # Noyoblik katta-kichik harfga bog'liq emas (Meta.constraints).
    email = models.EmailField(null=True, blank=True)  # noqa: DJ001
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STUDENT)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    all_objects = models.Manager()

    USERNAME_FIELD = "id"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        constraints = [
            models.UniqueConstraint(
                Lower("email"),
                condition=models.Q(email__isnull=False),
                name="accounts_user_email_ci_unique",
            ),
        ]

    def __str__(self) -> str:
        return self.email or str(self.id)

    def get_username(self) -> str:
        return self.email or str(self.pk)

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        else:
            self.email = None
        super().save(*args, **kwargs)


class Profile(UUIDModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=60, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)
    locale = models.CharField(max_length=8, choices=Locale.choices, default=Locale.UZ)
    grade = models.PositiveSmallIntegerField(null=True, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    grades = models.JSONField(default=list, blank=True)
    # null — onboarding tugamagan
    onboarded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(grade__isnull=True) | models.Q(grade__gte=1, grade__lte=11),
                name="accounts_profile_grade_range",
            ),
        ]

    def __str__(self) -> str:
        return self.display_name or str(self.user_id)


class Identity(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="identities")
    provider = models.CharField(max_length=16, choices=Provider.choices)
    provider_uid = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "identities"
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_uid"], name="accounts_identity_provider_uid_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.provider_uid}"


class AuthEventType(models.TextChoices):
    REGISTERED = "registered", "Registered"
    LOGIN = "login", "Login"
    LOGIN_FAILED = "login_failed", "Login failed"
    LOGIN_LOCKED = "login_locked", "Login locked"
    REFRESH_REUSE_DETECTED = "refresh_reuse_detected", "Refresh token reuse detected"
    LOGOUT = "logout", "Logout"
    LOGOUT_ALL = "logout_all", "Logout from all devices"
    EMAIL_VERIFICATION_SENT = "email_verification_sent", "Email verification sent"
    EMAIL_VERIFIED = "email_verified", "Email verified"
    PASSWORD_RESET_REQUESTED = "password_reset_requested", "Password reset requested"
    PASSWORD_RESET = "password_reset", "Password reset"
    PASSWORD_CHANGED = "password_changed", "Password changed"
    PASSWORD_SET = "password_set", "Password set"
    OTP_SENT = "otp_sent", "Sign-in code sent"
    IDENTITY_LINKED = "identity_linked", "Sign-in method linked"
    IDENTITY_UNLINKED = "identity_unlinked", "Sign-in method removed"
    ONBOARDED = "onboarded", "Onboarded"
    PROFILE_UPDATED = "profile_updated", "Profile updated"
    ROLE_CHANGED = "role_changed", "Role changed"
    DATA_EXPORTED = "data_exported", "Data exported"
    ACCOUNT_DELETED = "account_deleted", "Account deleted"


class AuthEvent(UUIDModel):
    """Audit jurnali (kirish, chiqish, parol, profil… hodisalari)."""

    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="auth_events"
    )
    type = models.CharField(max_length=32, choices=AuthEventType.choices, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.type} {self.created_at:%Y-%m-%d %H:%M}"


class TokenPurpose(models.TextChoices):
    EMAIL_VERIFY = "email_verify", "Email verification"
    PASSWORD_RESET = "password_reset", "Password reset"


class VerificationToken(UUIDModel):
    """Bir martalik email tokeni. Tokenning o'zi emas, faqat SHA-256 xeshi saqlanadi."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_tokens")
    purpose = models.CharField(max_length=16, choices=TokenPurpose.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    # Token berilgan paytdagi email: email o'zgarsa eski havola ishlamaydi.
    email = models.EmailField()
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "purpose"])]

    def __str__(self) -> str:
        return f"{self.purpose} {self.user_id}"


class RotatedRefreshToken(models.Model):
    """Refresh aylantirish (rotation) natijasida bekor qilinganini belgilaydi.

    Logout, parol almashtirish kabi qo'lda bekor qilingan tokenlarda yozuv yo'q — ularning
    qayta kelishi reuse hisoblanmaydi.
    """

    token = models.OneToOneField(
        OutstandingToken, on_delete=models.CASCADE, related_name="rotation"
    )
    rotated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"rotated {self.token_id}"


class OtpChallenge(UUIDModel):
    """Email bir martalik kodi. Kodning o'zi emas, faqat HMAC xeshi saqlanadi."""

    email = models.EmailField()
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["email", "-created_at"])]

    def __str__(self) -> str:
        return f"otp {self.created_at:%Y-%m-%d %H:%M}"
