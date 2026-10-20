"""Oddiy spam filtri: bir nechta havola, tipik spam iboralar, bir xil belgi takrori."""

import re

MAX_LINKS = 2
LINK_RE = re.compile(r"https?://|www\.|t\.me/", re.IGNORECASE)
REPEAT_RE = re.compile(r"(.)\1{14,}", re.DOTALL)
SPAM_PHRASES = (
    "casino",
    "viagra",
    "crypto",
    "bitcoin",
    "forex",
    "loan offer",
    "seo service",
    "buy followers",
    "porn",
    "ставки",
    "казино",
    "заработок",
)


def is_spam(message: str, name: str = "") -> bool:
    text = f"{name}\n{message}".lower()
    if len(LINK_RE.findall(text)) > MAX_LINKS:
        return True
    if REPEAT_RE.search(text):
        return True
    return any(phrase in text for phrase in SPAM_PHRASES)
