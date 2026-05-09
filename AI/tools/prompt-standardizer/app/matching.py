import json
import re
from dataclasses import dataclass

LEVEL_SCORE = {
    "expert": 4,
    "proficient": 3,
    "familiar": 2,
    "basic": 1,
}

# Human-readable skill tier labels (English only in codebase / API surface).
LEVEL_LABEL_EN = {
    "expert": "Expert",
    "proficient": "Proficient",
    "familiar": "Familiar",
    "basic": "Basic exposure",
}

BAND_LABEL_EN = {
    "primary": "Lead",
    "support": "Support",
    "observe": "Observer / backup",
}


def _normalize_goal(goal: str) -> str:
    return re.sub(r"\s+", " ", goal.strip().lower())


def _skill_mentioned(skill_name: str, goal_norm: str) -> bool:
    key = skill_name.strip().lower()
    if len(key) < 1:
        return False
    return key in goal_norm


@dataclass
class RoleSkillView:
    skill_name: str
    level: str


@dataclass
class RoleCardView:
    id: int
    display_name: str
    notes: str | None
    skills: list[RoleSkillView]


@dataclass
class PersonCardView:
    id: int
    display_name: str
    notes: str | None
    job_title: str | None
    team_name: str | None
    current_load: int
    skills: list[RoleSkillView]


def _norm_token(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _skill_tags_align(person_skill_norm: str, required_norm: str) -> bool:
    if not person_skill_norm or not required_norm:
        return False
    return person_skill_norm in required_norm or required_norm in person_skill_norm


def evaluate_persons_for_task_skills(
    required_skills: list[str],
    persons: list[PersonCardView],
    allocation_principles: str,
    engine_enabled: bool,
    load_penalty_per_unit: float = 3.0,
) -> dict:
    """Tag hit-rate + skill level weights + load penalty; no LLM."""
    req_list = [_norm_token(x) for x in required_skills if x and str(x).strip()]
    if not req_list:
        return {
            "engine_enabled": engine_enabled,
            "allocation_principles": allocation_principles,
            "required_skills": required_skills,
            "persons": [],
            "assignments": [],
            "formatted_summary": "No required skills provided; nothing to match.",
            "debug": {"reason": "empty_required"},
        }

    max_unit = float(LEVEL_SCORE["expert"])
    max_raw = max_unit * len(req_list)

    rows: list[dict] = []
    for p in persons:
        matched: list[dict] = []
        raw = 0.0
        for req in req_list:
            best_lvl = None
            best_w = 0.0
            best_name = ""
            for s in p.skills:
                sn = _norm_token(s.skill_name)
                if not _skill_tags_align(sn, req):
                    continue
                lvl = s.level if s.level in LEVEL_SCORE else "basic"
                w = float(LEVEL_SCORE[lvl])
                if w > best_w:
                    best_w = w
                    best_lvl = lvl
                    best_name = s.skill_name
            if best_lvl is not None:
                raw += best_w
                matched.append(
                    {
                        "required": req,
                        "matched_skill": best_name,
                        "level": best_lvl,
                        "level_label": LEVEL_LABEL_EN.get(best_lvl or "", best_lvl or ""),
                        "weight": best_w,
                    }
                )

        hit_count = len({m["required"] for m in matched})
        hit_ratio = hit_count / len(req_list) if req_list else 0.0
        base_pct = int(round(100.0 * raw / max_raw)) if max_raw > 0 else 0
        load_pen = float(load_penalty_per_unit) * max(0, int(p.current_load or 0))
        adjusted = max(0.0, float(base_pct) - load_pen)
        adjusted_pct = int(round(adjusted))

        rows.append(
            {
                "person_id": p.id,
                "display_name": p.display_name,
                "job_title": p.job_title,
                "team_name": p.team_name,
                "current_load": p.current_load,
                "notes": p.notes,
                "matched_skills": matched,
                "hit_ratio": round(hit_ratio, 3),
                "raw_score": raw,
                "match_percent": base_pct,
                "load_penalty_applied": round(load_pen, 2),
                "adjusted_percent": adjusted_pct,
                "skill_tree": [
                    {
                        "skill": s.skill_name,
                        "level": s.level,
                        "label": LEVEL_LABEL_EN.get(s.level, s.level),
                    }
                    for s in p.skills
                ],
            }
        )

    sorted_idx = sorted(range(len(rows)), key=lambda i: rows[i]["adjusted_percent"], reverse=True)
    top_adj = rows[sorted_idx[0]]["adjusted_percent"] if sorted_idx else 0

    assignments: list[dict] = []
    for i in sorted_idx:
        row = rows[i]
        adj = row["adjusted_percent"]
        if max_raw == 0:
            band = "observe"
        elif adj == top_adj and adj > 0:
            band = "primary"
        elif adj >= max(1, int(round(0.5 * top_adj))) and adj > 0:
            band = "support"
        else:
            band = "observe"
        assignments.append(
            {
                "person_id": row["person_id"],
                "display_name": row["display_name"],
                "band": band,
                "band_label": BAND_LABEL_EN[band],
                "match_percent": row["match_percent"],
                "adjusted_percent": adj,
                "hit_ratio": row["hit_ratio"],
                "current_load": row["current_load"],
                "matched_skills": row["matched_skills"],
            }
        )

    summary_lines: list[str] = []
    if not engine_enabled:
        summary_lines.append(
            "Person-task engine is OFF: scores are informational; allocation text is not a formal plan."
        )
    else:
        summary_lines.append("Allocation principles:")
        summary_lines.append(
            allocation_principles.strip()
            or "(No custom principles; ranking uses adjusted score = skill match % minus load penalty.)"
        )
    summary_lines.append("")
    summary_lines.append(f"Required skills ({len(req_list)}): " + ", ".join(required_skills))
    summary_lines.append("")
    if not any(r["raw_score"] > 0 for r in rows):
        summary_lines.append(
            "No person skill labels overlap the required tags (substring match). "
            "Align naming or broaden required tags."
        )
    else:
        summary_lines.append("Suggestions (by adjusted score):")
        for a in assignments:
            if a["band"] == "observe" and a["adjusted_percent"] == 0:
                continue
            hits = ", ".join(f"{m['matched_skill']}→{m['required']}" for m in a["matched_skills"]) or "—"
            summary_lines.append(
                f"- {a['display_name']} — {a['band_label']} — "
                f"match {a['match_percent']}% adj {a['adjusted_percent']}% "
                f"(load {a['current_load']}) — {hits}"
            )

    return {
        "engine_enabled": engine_enabled,
        "allocation_principles": allocation_principles,
        "required_skills": required_skills,
        "persons": rows,
        "assignments": assignments,
        "formatted_summary": "\n".join(summary_lines),
        "debug": {"max_raw": max_raw, "load_penalty_per_unit": load_penalty_per_unit},
    }


def evaluate_roles_for_goal(
    goal: str,
    roles: list[RoleCardView],
    allocation_principles: str,
    engine_enabled: bool,
) -> dict:
    goal_norm = _normalize_goal(goal)
    rows: list[dict] = []
    raw_scores: list[float] = []

    for r in roles:
        matched: list[dict] = []
        raw = 0.0
        for s in r.skills:
            lvl = s.level if s.level in LEVEL_SCORE else "basic"
            if _skill_mentioned(s.skill_name, goal_norm):
                w = float(LEVEL_SCORE[lvl])
                matched.append(
                    {
                        "skill": s.skill_name,
                        "level": lvl,
                        "level_label": LEVEL_LABEL_EN.get(lvl, lvl),
                        "weight": w,
                    }
                )
                raw += w
        raw_scores.append(raw)
        no_hit = "No skill keywords from this card appear verbatim in the task text."
        rationale = (
            "; ".join(f"{m['skill']} ({m['level_label']})" for m in matched) if matched else no_hit
        )
        rows.append(
            {
                "role_id": r.id,
                "display_name": r.display_name,
                "notes": r.notes,
                "skill_tree": [
                    {
                        "skill": s.skill_name,
                        "level": s.level,
                        "label": LEVEL_LABEL_EN.get(s.level, s.level),
                    }
                    for s in r.skills
                ],
                "matched_skills": matched,
                "raw_score": raw,
                "rationale": rationale,
            }
        )

    max_raw = max(raw_scores) if raw_scores else 0.0
    for row in rows:
        pct = int(round(100.0 * row["raw_score"] / max_raw)) if max_raw > 0 else 0
        row["match_percent"] = pct

    sorted_idx = sorted(range(len(rows)), key=lambda i: rows[i]["match_percent"], reverse=True)
    top_pct = rows[sorted_idx[0]]["match_percent"] if sorted_idx else 0

    assignments: list[dict] = []
    for i in sorted_idx:
        row = rows[i]
        pct = row["match_percent"]
        if max_raw == 0:
            band = "observe"
        elif pct == top_pct and pct > 0:
            band = "primary"
        elif pct >= max(1, int(round(0.5 * top_pct))) and pct > 0:
            band = "support"
        else:
            band = "observe"
        assignments.append(
            {
                "role_id": row["role_id"],
                "display_name": row["display_name"],
                "band": band,
                "band_label": BAND_LABEL_EN[band],
                "match_percent": pct,
                "matched_skills": row["matched_skills"],
                "rationale": row["rationale"],
            }
        )

    summary_lines: list[str] = []
    if not engine_enabled:
        summary_lines.append(
            "Role assignment engine is OFF: match scores are shown for reference only; "
            "allocation wording is not applied as a formal plan."
        )
    else:
        summary_lines.append("Allocation principles (current configuration):")
        summary_lines.append(
            allocation_principles.strip()
            or "(No custom principles text; default sort by match and Lead/Support labels.)"
        )

    summary_lines.append("")
    if max_raw == 0:
        summary_lines.append(
            "No skill names from role cards were found as substrings in the task text. "
            "Include stack keywords in the task description or rename skills to match."
        )
    else:
        summary_lines.append("Suggested split (by match score and principles):")
        for a in assignments:
            if a["band"] == "observe" and a["match_percent"] == 0:
                continue
            summary_lines.append(
                f"- {a['display_name']} - {a['band_label']} - match {a['match_percent']}% - {a['rationale']}"
            )

    return {
        "engine_enabled": engine_enabled,
        "allocation_principles": allocation_principles,
        "goal": goal,
        "roles": rows,
        "assignments": assignments,
        "formatted_summary": "\n".join(summary_lines),
        "debug": {"max_raw": max_raw, "normalized": bool(max_raw)},
    }


def dumps_result(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)
