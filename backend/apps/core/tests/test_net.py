import pytest
from django.test import RequestFactory

from apps.core.net import client_ip


@pytest.fixture
def rf():
    return RequestFactory()


def make(rf, xff=None, secret=None, remote="10.0.0.9"):
    extra = {"REMOTE_ADDR": remote}
    if xff is not None:
        extra["HTTP_X_FORWARDED_FOR"] = xff
    if secret is not None:
        extra["HTTP_X_FORWARDED_SECRET"] = secret
    return rf.get("/", **extra)


class TestClientIp:
    def test_spoofed_xff_is_ignored_without_secret(self, rf, settings):
        settings.FORWARDED_IP_SECRET = "s3"
        settings.TRUSTED_PROXY_HOPS = 0
        assert client_ip(make(rf, xff="1.2.3.4")) == "10.0.0.9"
        assert client_ip(make(rf, xff="1.2.3.4", secret="wrong")) == "10.0.0.9"

    def test_trusted_forwarder_with_secret(self, rf, settings):
        settings.FORWARDED_IP_SECRET = "s3"
        assert client_ip(make(rf, xff="5.6.7.8", secret="s3")) == "5.6.7.8"

    def test_empty_secret_never_trusts(self, rf, settings):
        settings.FORWARDED_IP_SECRET = ""
        settings.TRUSTED_PROXY_HOPS = 0
        assert client_ip(make(rf, xff="5.6.7.8", secret="")) == "10.0.0.9"

    def test_proxy_hops_take_rightmost_entries(self, rf, settings):
        settings.FORWARDED_IP_SECRET = ""
        settings.TRUSTED_PROXY_HOPS = 1
        # Mijoz "1.1.1.1" ni soxtalashtirdi, proxy haqiqiy manzilni oxiriga qo'shdi.
        assert client_ip(make(rf, xff="1.1.1.1, 9.9.9.9")) == "9.9.9.9"

    def test_invalid_values_fall_back(self, rf, settings):
        settings.FORWARDED_IP_SECRET = "s3"
        assert client_ip(make(rf, xff="not-an-ip", secret="s3")) == "10.0.0.9"
