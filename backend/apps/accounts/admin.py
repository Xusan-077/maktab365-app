from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuthEvent, Identity, Profile, User


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0


class IdentityInline(admin.TabularInline):
    model = Identity
    extra = 0
    readonly_fields = ["created_at"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "role", "is_active", "is_staff", "date_joined", "last_login"]
    list_filter = ["role", "is_active", "is_staff", "is_superuser"]
    search_fields = ["email", "id", "profile__display_name"]
    readonly_fields = ["id", "date_joined", "last_login", "deleted_at"]
    inlines = [ProfileInline, IdentityInline]
    fieldsets = (
        (None, {"fields": ("id", "email", "email_verified_at", "password")}),
        ("Role", {"fields": ("role",)}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Dates", {"fields": ("date_joined", "last_login", "deleted_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role")}),
    )

    def get_queryset(self, request):
        return User.all_objects.all()


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "display_name", "locale", "grade", "onboarded_at"]
    list_filter = ["locale", "grade"]
    search_fields = ["display_name", "user__email"]
    raw_id_fields = ["user"]


@admin.register(Identity)
class IdentityAdmin(admin.ModelAdmin):
    list_display = ["provider", "provider_uid", "email", "verified", "user", "created_at"]
    list_filter = ["provider", "verified"]
    search_fields = ["provider_uid", "email", "user__email"]
    raw_id_fields = ["user"]


@admin.register(AuthEvent)
class AuthEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "type", "user", "ip"]
    list_filter = ["type"]
    search_fields = ["user__email", "ip"]
    raw_id_fields = ["user"]
    readonly_fields = ["created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
