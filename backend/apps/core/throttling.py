from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AnonBurstThrottle(AnonRateThrottle):
    scope = "anon"


class UserBurstThrottle(UserRateThrottle):
    scope = "user"


class AuthRateThrottle(AnonRateThrottle):
    """Kirish/ro'yxatdan o'tish kabi sezgir endpoint'lar uchun (IP bo'yicha qattiqroq)."""

    scope = "auth"
