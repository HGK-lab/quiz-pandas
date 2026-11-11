import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"


def _load(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


EXAMPLES_JSON = _load("examples.json", [])
_cards = _load("cards.json", {"units": [], "cards": []})
UNITS, CARDS = _cards["units"], _cards["cards"]
QUESTIONS = _load("questions.json", [])

REQUIRED_EXAMPLE_IDS = (
    "isnull_sum dropna_any dropna_all_axis1 dropna_subset dropna_thresh fillna_zero "
    "fillna_dict fillna_dict_limit fillna_str drop_columns astype_int to_datetime_coerce "
    "dtypes rename_columns loc_assign sort_desc sort_multi dup_default dup_subset_first "
    "dup_keep_last outlier_filter outlier_median str_strip str_replace_name str_upper "
    "str_symbols str_comma str_percent concat_rows concat_cols concat_inner merge_inner "
    "merge_outer merge_left merge_right"
).split()


def _tables(e):
    return e["before"] + ([e["after"]] if "rows" in e["after"] else [])


def test_examples_ids_unique_and_complete():
    ids = [e["id"] for e in EXAMPLES_JSON]
    assert len(ids) == len(set(ids))
    assert set(REQUIRED_EXAMPLE_IDS) <= set(ids), sorted(set(REQUIRED_EXAMPLE_IDS) - set(ids))


def test_tables_are_rectangular():
    for e in EXAMPLES_JSON:
        for t in _tables(e):
            assert all(len(r) == len(t["columns"]) for r in t["rows"]), e["id"]
            assert len(t["index"]) == len(t["rows"]), e["id"]


def test_deleted_rows_match_index_diff():
    for e in EXAMPLES_JSON:
        if "rows" in e["after"] and len(e["before"]) == 1:
            assert set(e["after"]["deleted"]) == set(e["before"][0]["index"]) - set(e["after"]["index"]), e["id"]


def test_column_marks_are_consistent():
    for e in EXAMPLES_JSON:
        a = e["after"]
        if "rows" in a and len(e["before"]) == 1:
            assert set(a["deletedCols"]) == set(e["before"][0]["columns"]) - set(a["columns"]), e["id"]
            assert all(j < len(a["columns"]) for j in a["changedCols"]), e["id"]


def test_changed_cells_in_range():
    for e in EXAMPLES_JSON:
        a = e["after"]
        if "rows" in a:
            for r, c in a["changed"]:
                assert r < len(a["rows"]) and c < len(a["columns"]), e["id"]


# --- Task 2: 개념 카드 ---

def test_units_are_five_in_order():
    assert [u["no"] for u in UNITS] == [1, 2, 3, 4, 5]


def test_cards_per_unit_8_to_12():
    for u in range(1, 6):
        assert 8 <= sum(c["unit"] == u for c in CARDS) <= 12, u


def test_card_ids_unique():
    ids = [c["id"] for c in CARDS]
    assert len(ids) == len(set(ids))


def test_card_example_ids_exist():
    ids = {e["id"] for e in EXAMPLES_JSON}
    assert all(c["exampleId"] in ids for c in CARDS if c["exampleId"])


def test_every_example_used_by_a_card():
    used = {c["exampleId"] for c in CARDS}
    assert {e["id"] for e in EXAMPLES_JSON} <= used, sorted({e["id"] for e in EXAMPLES_JSON} - used)


def test_traps_present():
    text = json.dumps(CARDS, ensure_ascii=False)
    for k in ["astype", "copy=False", "limit", "inplace", "NaT", "dtypes"]:
        assert k in text, k
