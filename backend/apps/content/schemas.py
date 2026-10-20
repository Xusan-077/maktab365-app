"""
Mavzu kontenti sxemasi (pydantic) — frontend `src/lib/api/schemas.ts` va
`src/lib/content/validate.ts` bilan 1:1. Ikki tomon ham ildizdagi `contracts/fixtures/`
namunalari bilan tekshiriladi.

Blok JSON'i frontend fayllaridagi kabi saqlanadi (kalitlar camelCase: `answerType`,
`sortKey`), chunki bu kontent fayli formati; API konvertatsiyasi keyingi bosqichda.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StringConstraints,
    model_validator,
)
from pydantic import ValidationError as PydanticValidationError

CONTENT_STATUSES = ("draft", "reviewed")
WIDGET_KINDS = ("quadratic-graph", "choice-explain", "geometry-points", "timeline")
SECTION_KEYS = ("goal", "explanation", "rule", "example", "exercise", "summary")
# Widget qaysi bo'lim ichida chiziladi (frontend `WIDGET_SECTION`).
WIDGET_SECTION = {
    "quadratic-graph": "rule",
    "choice-explain": "exercise",
    "geometry-points": "rule",
    "timeline": "rule",
}

KEBAB_CASE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

NonEmpty = Annotated[str, StringConstraints(min_length=1)]
Number = Annotated[float, Field(strict=True, allow_inf_nan=False)]


@dataclass(frozen=True)
class Issue:
    """Bitta muammo: maydon yo'li (`blocks[3].hint`), sababi va pydantic xato turi."""

    path: str
    message: str
    code: str = "invalid"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LocalizedText(_Strict):
    uz: NonEmpty
    # Tarjima keyin to'ldiriladi: bo'sh qator ham ruxsat.
    ru: str = Field(default=None)
    en: str = Field(default=None)


class _Block(_Strict):
    id: NonEmpty


class GoalBlock(_Block):
    type: Literal["goal"]
    text: LocalizedText


class ExplanationBlock(_Block):
    type: Literal["explanation"]
    title: LocalizedText = Field(default=None)
    text: LocalizedText


class RuleBlock(_Block):
    type: Literal["rule"]
    title: LocalizedText = Field(default=None)
    text: LocalizedText
    formula: NonEmpty = Field(default=None)


class ExampleStep(_Strict):
    text: LocalizedText
    formula: NonEmpty = Field(default=None)


class ExampleBlock(_Block):
    type: Literal["example"]
    title: LocalizedText = Field(default=None)
    steps: Annotated[list[ExampleStep], Field(min_length=1)]


class _Exercise(_Block):
    type: Literal["exercise"]
    question: LocalizedText
    hint: LocalizedText = Field(default=None)
    explanation: LocalizedText = Field(default=None)


class ChoiceExercise(_Exercise):
    answerType: Literal["choice"]  # noqa: N815
    options: Annotated[list[LocalizedText], Field(min_length=2)]
    answer: Annotated[StrictInt, Field(ge=0)]

    @model_validator(mode="after")
    def _check(self):
        if self.answer >= len(self.options):
            raise ValueError("Javob indeksi variantlar ichida bo'lishi kerak")
        return self


class InputExercise(_Exercise):
    answerType: Literal["input"]  # noqa: N815
    answer: Annotated[list[NonEmpty], Field(min_length=1)]


class TrueFalseExercise(_Exercise):
    answerType: Literal["truefalse"]  # noqa: N815
    answer: StrictBool


class OrderExercise(_Exercise):
    answerType: Literal["order"]  # noqa: N815
    items: Annotated[list[LocalizedText], Field(min_length=2)]
    answer: Annotated[list[Annotated[StrictInt, Field(ge=0)]], Field(min_length=2)]

    @model_validator(mode="after")
    def _check(self):
        count = len(self.items)
        if (
            len(self.answer) != count
            or len(set(self.answer)) != count
            or any(index >= count for index in self.answer)
        ):
            raise ValueError("Javob items indekslarining to'liq almashtirishi bo'lishi kerak")
        return self


class SummaryBlock(_Block):
    type: Literal["summary"]
    points: Annotated[list[LocalizedText], Field(min_length=1)]


class QuadraticGraphProps(_Strict):
    a: Number
    b: Number
    c: Number


class ChoiceExplainOption(_Strict):
    text: str
    correct: StrictBool
    reason: LocalizedText


class ChoiceExplainProps(_Strict):
    prompt: str
    options: Annotated[list[ChoiceExplainOption], Field(min_length=2)]

    @model_validator(mode="after")
    def _check(self):
        if sum(option.correct for option in self.options) != 1:
            raise ValueError("Aynan bitta variant to'g'ri bo'lishi kerak")
        return self


class GeometryPoint(_Strict):
    label: str
    x: StrictInt
    y: StrictInt


class GeometryPointsProps(_Strict):
    points: Annotated[list[GeometryPoint], Field(min_length=3, max_length=3)]


class TimelineEvent(_Strict):
    id: NonEmpty
    sortKey: StrictInt  # noqa: N815
    date: LocalizedText
    title: LocalizedText
    description: LocalizedText


class TimelineProps(_Strict):
    events: Annotated[list[TimelineEvent], Field(min_length=2)]


_WIDGET_PROPS: dict[str, type[BaseModel]] = {
    "quadratic-graph": QuadraticGraphProps,
    "choice-explain": ChoiceExplainProps,
    "geometry-points": GeometryPointsProps,
    "timeline": TimelineProps,
}


class WidgetBlock(_Block):
    type: Literal["widget"]
    kind: Literal["quadratic-graph", "choice-explain", "geometry-points", "timeline"]
    props: dict[str, Any]


class TopicFile(_Strict):
    """Mavzu fayli (`src/content/.../<mavzu>.json`); bloklar alohida, turi bo'yicha tekshiriladi."""

    status: Literal["draft", "reviewed"]
    order: Annotated[StrictInt, Field(ge=1)]
    title: LocalizedText
    notes: list[NonEmpty] = Field(default=None)
    blocks: Annotated[list[Any], Field(min_length=1)]


class ChapterFile(_Strict):
    order: Annotated[StrictInt, Field(ge=1)]
    title: LocalizedText


_BLOCK_MODELS: dict[str, type[BaseModel]] = {
    "goal": GoalBlock,
    "explanation": ExplanationBlock,
    "rule": RuleBlock,
    "example": ExampleBlock,
    "summary": SummaryBlock,
    "widget": WidgetBlock,
}
_EXERCISE_MODELS: dict[str, type[BaseModel]] = {
    "choice": ChoiceExercise,
    "input": InputExercise,
    "truefalse": TrueFalseExercise,
    "order": OrderExercise,
}


def _path(parts: tuple[Any, ...], prefix: str = "") -> str:
    out = prefix
    for part in parts:
        if isinstance(part, int):
            out += f"[{part}]"
        else:
            out += f".{part}" if out else str(part)
    return out or "(fayl)"


def _issues(error: PydanticValidationError, prefix: str = "") -> list[Issue]:
    # `value_error` xabari "Value error, ..." bilan boshlanadi.
    return [
        Issue(_path(item["loc"], prefix), item["msg"].removeprefix("Value error, "), item["type"])
        for item in error.errors(include_url=False)
    ]


def _block_model(block: Any) -> type[BaseModel] | None:
    if not isinstance(block, dict):
        return None
    if block.get("type") == "exercise":
        answer_type = block.get("answerType")
        return _EXERCISE_MODELS.get(answer_type) if isinstance(answer_type, str) else None
    block_type = block.get("type")
    return _BLOCK_MODELS.get(block_type) if isinstance(block_type, str) else None


def block_schema_issues(blocks: list[Any], prefix: str = "blocks") -> list[Issue]:
    """Har bir blokni turiga mos modelga qarshi tekshiradi (yo'l: `blocks[3].hint`)."""
    issues: list[Issue] = []
    for index, block in enumerate(blocks):
        model = _block_model(block)
        where = f"{prefix}[{index}]"
        if model is None:
            issues.append(Issue(where, "Noma'lum blok turi", "unknown_block"))
            continue
        try:
            model.model_validate(block)
        except PydanticValidationError as error:
            issues.extend(_issues(error, where))
            continue
        if block["type"] == "widget":
            # `props` kind'ga mos modelga qarshi tekshiriladi (yo'l: `blocks[3].props.options[0]`).
            try:
                _WIDGET_PROPS[block["kind"]].model_validate(block["props"])
            except PydanticValidationError as error:
                issues.extend(_issues(error, f"{where}.props"))
    return issues


def _is_blank(value: Any) -> bool:
    return not isinstance(value, str) or value.strip() == ""


def blank_text_issues(value: Any, path: str = "") -> list[Issue]:
    """`{uz: "…"}` ko'rinishidagi har bir matnda `uz` bo'sh (faqat probel) bo'lmasligi kerak."""
    if isinstance(value, list):
        return [i for n, item in enumerate(value) for i in blank_text_issues(item, f"{path}[{n}]")]
    if not isinstance(value, dict):
        return []
    if isinstance(value.get("uz"), str):
        if _is_blank(value["uz"]):
            return [Issue(f"{path}.uz" if path else "uz", "matn bo'sh bo'lmasligi kerak", "blank")]
        return []
    return [
        i
        for key, item in value.items()
        for i in blank_text_issues(item, f"{path}.{key}" if path else key)
    ]


def _section_of(block: dict[str, Any]) -> str:
    return WIDGET_SECTION[block["kind"]] if block["type"] == "widget" else block["type"]


def block_rule_issues(blocks: list[dict[str, Any]]) -> list[Issue]:
    """Sxemadan tashqari kontent qoidalari (frontend `blockIssues`); bloklar sxemadan o'tgan."""
    issues: list[Issue] = []
    seen: set[str] = set()
    for index, block in enumerate(blocks):
        if block["id"] in seen:
            issues.append(
                Issue(f"blocks[{index}].id", f'blok id takrorlangan: "{block["id"]}"', "duplicate")
            )
        seen.add(block["id"])

    previous = -1
    for index, block in enumerate(blocks):
        position = SECTION_KEYS.index(_section_of(block))
        if position < previous:
            issues.append(
                Issue(
                    f"blocks[{index}]",
                    f"blok tartibi noto'g'ri: \"{_section_of(block)}\" bo'limi "
                    f'"{SECTION_KEYS[previous]}" dan keyin kelmasligi kerak',
                    "section_order",
                )
            )
        previous = max(previous, position)

    for key in SECTION_KEYS:
        count = sum(1 for block in blocks if _section_of(block) == key)
        if count == 0:
            issues.append(Issue("blocks", f'"{key}" bloki yo\'q', "missing_section"))
        if key in ("goal", "summary") and count > 1:
            issues.append(
                Issue(
                    "blocks",
                    f'"{key}" bloki bitta bo\'lishi kerak ({count} ta bor)',
                    "duplicate_section",
                )
            )

    exercises = [(i, b) for i, b in enumerate(blocks) if b["type"] == "exercise"]
    if len(exercises) < 3:
        issues.append(
            Issue("blocks", f"kamida 3 ta mashq kerak ({len(exercises)} ta bor)", "few_exercises")
        )
    for index, block in exercises:
        if _is_blank((block.get("hint") or {}).get("uz")):
            issues.append(
                Issue(f"blocks[{index}].hint", "mashqda hint (maslahat) bo'lishi kerak", "no_hint")
            )
        if _is_blank((block.get("explanation") or {}).get("uz")):
            issues.append(
                Issue(
                    f"blocks[{index}].explanation",
                    "mashqda explanation (tushuntirish) bo'lishi kerak",
                    "no_explanation",
                )
            )
        if block["answerType"] == "order" and block["answer"] == list(range(len(block["answer"]))):
            issues.append(
                Issue(
                    f"blocks[{index}].items",
                    "items allaqachon to'g'ri tartibda: mashq aralash tartibda berilishi kerak",
                    "sorted_order",
                )
            )

    for index, block in enumerate(blocks):
        if block["type"] != "widget" or block["kind"] != "timeline":
            continue
        events = block["props"]["events"]
        for n in range(1, len(events)):
            if events[n]["sortKey"] <= events[n - 1]["sortKey"]:
                issues.append(
                    Issue(
                        f"blocks[{index}].props.events[{n}].sortKey",
                        "voqealar sortKey (sana) bo'yicha o'sish tartibida bo'lishi kerak",
                        "timeline_order",
                    )
                )
        if len({event["id"] for event in events}) != len(events):
            issues.append(
                Issue(f"blocks[{index}].props.events", "voqea id'lari takrorlangan", "duplicate")
            )
    return issues


def validate_blocks(blocks: Any) -> list[Issue]:
    """Bloklarni to'liq tekshiradi (sxema + kontent qoidalari). Bo'sh ro'yxat — xato yo'q."""
    if not isinstance(blocks, list) or not blocks:
        return [Issue("blocks", "bloklar ro'yxati bo'sh bo'lmasligi kerak", "too_short")]
    issues = block_schema_issues(blocks)
    if issues:
        return issues
    return blank_text_issues(blocks, "blocks") or block_rule_issues(blocks)


def validate_topic_file(data: Any) -> list[Issue]:
    """Mavzu fayli: sxema + kontent qoidalari (frontend `validateTopicFile`)."""
    if not isinstance(data, dict):
        return [Issue("(fayl)", "obyekt bo'lishi kerak", "model_type")]
    try:
        TopicFile.model_validate(data)
        issues: list[Issue] = []
    except PydanticValidationError as error:
        issues = _issues(error)
    if "blocks" in data and isinstance(data["blocks"], list) and data["blocks"]:
        issues += block_schema_issues(data["blocks"])
    if issues:
        return issues

    extra = blank_text_issues(data) or block_rule_issues(data["blocks"])
    notes = data.get("notes") or []
    if data["status"] == "reviewed" and notes:
        extra.append(
            Issue(
                "notes",
                f'status "reviewed", lekin {len(notes)} ta ochiq izoh (TODO) bor',
                "open_notes",
            )
        )
    return extra


def validate_chapter_file(data: Any) -> list[Issue]:
    if not isinstance(data, dict):
        return [Issue("(fayl)", "obyekt bo'lishi kerak", "model_type")]
    try:
        ChapterFile.model_validate(data)
    except PydanticValidationError as error:
        return _issues(error)
    return blank_text_issues(data)


def format_issues(issues: list[Issue]) -> str:
    return "; ".join(f"{issue.path}: {issue.message}" for issue in issues)
