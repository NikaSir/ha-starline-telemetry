#!/usr/bin/env python3
"""Fail CI when a repository drifts from the mandatory NikaS UI contract."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / ".nikas-ui-standard.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def read_relative(path: str) -> str:
    target = ROOT / path
    require(target.is_file(), f"missing required file: {path}")
    return target.read_text(encoding="utf-8")


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    require(config.get("version") == "1.7", "NikaS UI standard version must be 1.7")

    standard_path = config.get("standard_path", "docs/NIKAS_SPECIALIZED_PANEL_UI_STANDARD.md")
    standard = read_relative(standard_path)
    digest = hashlib.sha256(standard.encode("utf-8")).hexdigest()
    require(digest == config.get("standard_sha256"), "local NikaS UI standard is not the canonical v1.7 copy")
    for clause in (
        "Center title plaque — return to the source NikaS base panel",
        'sessionStorage["nikas.specialized.source_route.v1"]',
        "return_to",
        "history.pushState()",
        "history.back()",
    ):
        require(clause in standard, f"canonical Header-return clause missing: {clause}")

    role = config.get("role")
    sources = "\n".join(read_relative(path) for path in config.get("runtime_files", []))
    require(role in {"base", "specialized", "readiness"}, f"unsupported NikaS UI role: {role}")

    if role == "readiness":
        compliance = read_relative(config["compliance_path"])
        require("GAP" in compliance, "readiness-only repository must record the absent runtime as GAP")
        return

    for token in (
        "nikas.specialized.source_route.v1",
        "/dashboard-house",
        "/dashboard-actions",
        "/dashboard-infrastructure",
    ):
        require(token in sources, f"runtime route contract missing token: {token}")

    if role == "base":
        require("sessionStorage" in sources, "base shell must persist the source-route hand-off")
        return

    for token in ("return_to", "from", "history.pushState", "location-changed", "UI v"):
        require(token in sources, f"specialized Header-return runtime missing token: {token}")
    require("history.back(" not in sources, "history.back() is forbidden by the NikaS routing contract")
    require("<button" in sources or 'createElement("button")' in sources, "center title must be a semantic button")


if __name__ == "__main__":
    main()
