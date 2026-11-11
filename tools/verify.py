"""문제은행 정답 검증.

expect가 있는 문항은 code를 실제 pandas로 실행해 출력이 expect와 같은지,
객관식이면 정답 보기가 expect와 같은지 확인한다.

실행: tools/.venv/Scripts/python tools/verify.py
"""
import json
import subprocess
import sys
from pathlib import Path

QUESTIONS = Path(__file__).resolve().parents[1] / "data" / "questions.json"


def run_code(code: str) -> str:
    proc = subprocess.run(
        [sys.executable, "-c", "import pandas as pd\n" + code],
        capture_output=True, text=True, encoding="utf-8", timeout=10,
        env={"PYTHONIOENCODING": "utf-8", "PYTHONWARNINGS": "error::FutureWarning", **_base_env()},
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else "exit %d" % proc.returncode)
    return proc.stdout.strip()


def _base_env():
    import os
    return {k: v for k, v in os.environ.items() if k not in ("PYTHONIOENCODING", "PYTHONWARNINGS")}


def verify(q: dict):
    """문제가 없으면 None, 있으면 오류 문장."""
    expect = q.get("expect")
    if expect is None:
        return None
    try:
        out = run_code(q["code"])
    except Exception as e:  # 실행 실패도 오류로 보고
        return f"{q['id']}: 실행 실패 {e}"
    if out != expect:
        return f"{q['id']}: 출력 {out!r} != expect {expect!r}"
    if q["type"] == "mc" and q["choices"][q["answer"]] != expect:
        return f"{q['id']}: 정답 보기 {q['choices'][q['answer']]!r} != expect {expect!r}"
    if q["type"] == "ox" and expect not in q["explain"]:
        return f"{q['id']}: O/X 해설에 실행 결과 {expect!r}가 없음"
    return None


if __name__ == "__main__":
    qs = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    errors = [e for q in qs if (e := verify(q))]
    print("\n".join(errors) if errors else f"OK: {sum(q.get('expect') is not None for q in qs)}문항 실행 검증, {len(qs)}문항 전체")
    sys.exit(1 if errors else 0)
