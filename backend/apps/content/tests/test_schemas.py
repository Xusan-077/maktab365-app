"""
Shartnoma testi: ildizdagi `contracts/fixtures/` namunalari. Frontend
(`src/lib/content/contract.test.ts`) xuddi shu fayllar va kutilgan yo'llar bilan tekshiriladi.
"""

import copy
import json
from pathlib import Path

import pytest

from apps.content.schemas import validate_blocks, validate_chapter_file, validate_topic_file

FIXTURES = Path(__file__).resolve().parents[4] / "contracts" / "fixtures"
EXPECTED = json.loads((FIXTURES / "expected.json").read_text(encoding="utf-8"))
EXPECTED.pop("_comment")


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


RULE_CODES = {"timeline_order", "duplicate"}


def common_paths(issues):
    """Frontend bilan solishtirish: widget `props` va noma'lum kalit xatolari blok darajasiga."""
    paths = set()
    for issue in issues:
        path = issue.path
        if issue.code == "extra_forbidden":
            path = path.rsplit(".", 1)[0]
        if ".props" in path and issue.code not in RULE_CODES:
            path = path.split(".props")[0]
        paths.add(path)
    return paths


def test_valid_fixture_has_no_issues():
    assert validate_topic_file(load("topic-valid.json")) == []


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_invalid_fixture_reports_expected_paths(name):
    issues = validate_topic_file(load(name))
    assert common_paths(issues) == set(EXPECTED[name])


def test_every_invalid_fixture_is_listed():
    on_disk = {p.name for p in FIXTURES.glob("topic-invalid-*.json")}
    assert on_disk == set(EXPECTED)


def block(data, block_id):
    return next(item for item in data["blocks"] if item["id"] == block_id)


def test_error_names_block_and_field():
    data = load("topic-valid.json")
    block(data, "exercise-choice")["options"] = ["A", "B"]
    (issue, *rest) = validate_blocks(data["blocks"])
    assert issue.path.startswith("blocks[7].options[0]")


def test_widget_error_has_field_path():
    data = load("topic-valid.json")
    block(data, "widget-choice")["props"]["options"][0]["correct"] = True
    issues = validate_blocks(data["blocks"])
    assert [i.path for i in issues] == ["blocks[11].props"]


def test_floats_are_not_integers():
    data = load("topic-valid.json")
    block(data, "exercise-choice")["answer"] = 1.5
    assert [i.path for i in validate_blocks(data["blocks"])] == ["blocks[7].answer"]


def test_booleans_are_not_numbers():
    data = load("topic-valid.json")
    block(data, "widget-graph")["props"]["a"] = True
    assert validate_blocks(data["blocks"])


def test_input_does_not_mutate_data():
    data = load("topic-valid.json")
    before = copy.deepcopy(data)
    validate_topic_file(data)
    assert data == before


def test_chapter_file():
    assert validate_chapter_file({"order": 1, "title": {"uz": "Bob"}}) == []
    assert [i.path for i in validate_chapter_file({"order": 0, "title": {"uz": "Bob"}})] == [
        "order"
    ]
    assert [i.path for i in validate_chapter_file({"order": 1, "title": {"uz": " "}})] == [
        "title.uz"
    ]
