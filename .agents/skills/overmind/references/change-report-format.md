# Change Report Format Specification

This document defines a streamlined change-report system for resume optimization tracking. It removes redundant scoring, excessive rendering rules, and duplicated ATS logic while preserving analytical clarity.

---

# 1. Output Rules

* Format: PDF
* Orientation: Landscape
* Filename:

```
[Company]_[Role]_ChangeReport_[YYYY-MM-DD].pdf
```

Fallback:

* Unknown company → `UnknownCompany_[Role]_[YYYY-MM-DD].pdf`
* Unknown role → `[Company]_ResumeOptimization_[YYYY-MM-DD].pdf`

---

# 2. Report ID

```
CR-[YYYYMMDD]-[Sequence]
```

Example:

```
CR-20260602-001
```

Header:

```
Report ID: CR-20260602-001
Generated: 2026-06-02 14:32 UTC
Company: [Target Company]
Role: [Target Role]
```

---

# 3. Report Structure

## 3.1 Executive Summary

```
Company:        [Target Company]
Role:           [Target Role]
Resume File:    [Original filename]

Total Changes:  [N]
Added Items:    [N]
Removed Items:  [N]
Rewritten Items:[N]
Reordered Items:[N]
ATS Keywords Added: [N]
ATS Keywords Removed: [N]
```

---

## 3.2 Change Impact Summary (Single Layer Only)

| Area            | Impact              | Notes                    |
| --------------- | ------------------- | ------------------------ |
| ATS Alignment   | High / Medium / Low | Keyword coverage delta   |
| Technical Depth | High / Medium / Low | Evidence strength change |
| Quantification  | High / Medium / Low | Metrics added/removed    |
| Readability     | High / Medium / Low | Structural clarity       |
| Risk            | None / Low / Medium | Unsupported claims check |

**Overall Result:**

* Net improvement assessment (1–2 lines max)

---

## 3.3 Skill + ATS Mapping (Unified Table)

Combines skill coverage, ATS keywords, and missing skills.

| Skill / Keyword | Status  | Evidence        | Action    |
| --------------- | ------- | --------------- | --------- |
| Python          | PRESENT | 3 yrs, projects | —         |
| FastAPI         | PRESENT | backend APIs    | —         |
| Kubernetes      | PARTIAL | Docker only     | not added |
| Terraform       | MISSING | none            | rejected  |

Status values:

* PRESENT
* PARTIAL
* MISSING

Action values:

* ADDED
* REJECTED
* REWRITTEN
* NONE

---

## 3.4 Section-by-Section Diffs

Applies to:

* Summary
* Experience
* Projects
* Skills
* Certifications

### Format:

```
## [Section Name]

| # | Original | Modified | Change Type | Rationale |
|---|----------|----------|-------------|-----------|
| 1 | text | text | REWRITE | reason |
| 2 | text | — | REMOVED | reason |
| 3 | — | text | ADDED | reason |
```

Change Types:

* ADDED
* REMOVED
* REWRITE
* REORDERED

---

## 3.5 Removed Content Log

Only truly deleted items that impact resume content.

| Removed Item | Section    | Reason        |
| ------------ | ---------- | ------------- |
| Example text | Experience | low relevance |

---

## 3.6 Unsupported / Rejected Skills

Only include skills that were attempted but not supported.

| Skill         | Reason                 |
| ------------- | ---------------------- |
| Kubernetes    | no deployment evidence |
| System Design | no explicit experience |

---

## 4. ATS Keyword Handling Rules

* Single unified ATS system only
* No separate keyword scoring layers
* No duplication across sections
* No keyword inflation without evidence

Rules:

* Only include keywords grounded in resume evidence
* Rejected keywords must have explicit reason
* No scoring or percentage-based ATS metrics

---

## 5. Formatting Rules (Simplified)

### Required

* Tables for all diffs
* Clear section headers
* Consistent “Change Type” column

### Removed (intentionally simplified)

* Color-coded diff systems
* Hex codes
* Grayscale rendering rules
* Symbol systems (+ - ~ ↕)
* Page number requirements
* Table of contents rules
* Font restrictions

---

## 6. Evidence Integrity Rule

All additions must satisfy:

```
Claim must be supported by at least one:
- Resume line
- Project evidence
- Work experience statement
```

If not:

* Mark as REJECTED or UNSUPPORTED

---

## 7. Structural Constraints

* No duplicated evaluation layers
* No separate scoring engines
* No rendering-layer specifications
* No versioning system inside report body

---

## 8. Final Statistics

```
Total Changes:        [N]
Added Lines:          [N]
Removed Lines:        [N]
Modified Lines:       [N]
Sections Modified:    [list]

ATS Coverage (Before): [X%]
ATS Coverage (After):  [Y%]

Net Improvement:       Low / Medium / High