---
name: root-network
description: >
  Graph-based orchestration skill for resume improvement, ATS optimization, and role/company alignment.
  Uses specialized skills via find-skill, enforces evidence-based constraints, and produces structured outputs
  with mandatory reporting and traceability.
---

# RESUME-IMPROVEMENT — GRAPH ORCHESTRATION SYSTEM

## 0. System Type
This is a:
- Weighted directed skill graph
- Not a pipeline
- Not a prompt chain

Execution is dynamic, node-based, and governed by global invariants.

---

## 1. INPUT MODEL

### CONSTANT INPUT
- main.tex (immutable resume state)

### VARIABLE INPUT
- Job Description (JD)

### RULE
- Execution always starts from: main.tex + JD
- main.tex is NEVER modified directly (only derived transformations)

---

## 2. GLOBAL GOVERNANCE LAYER (APPLIES TO ALL NODES)

### 2.1 Evidence Policy (HARD CONSTRAINT)
- Never invent experience under any condition
- Every claim must be supported by:
  - user-provided resume data OR
  - job description OR
  - verified company data (search-backed)

If evidence is missing:
- DO NOT generate the claim
- Route to "Recommended Upskills"
- Log exclusion reason in report

---

### 2.2 Constraint Layer
- No fabrication
- No inference from industry adjacency
- ATS-friendly format only (single-column, no tables, no graphics)
- Preserve candidate truth over optimization
- All transformations must be traceable

---

### 2.3 LaTeX Output Contract (STRICT)
- Source file: `main.tex` is READ ONLY. Never overwrite it.
- Only modify content inside existing environments.
- Do NOT change:
  - preamble
  - packages
  - macros
  - document structure

- Output filename:
  `<company_name>_<role_name>.tex`

- Violation invalidates output

---

### 2.4 Report Requirement (MANDATORY)
Every output MUST include:
- Change Report
- Skill execution trace
- Evidence trace
- Recommended Upskills (if exclusions occurred)

---

## 3. SKILL DISCOVERY LAYER (MANDATORY)

Before execution:
- Call `find-skill` for all required capabilities
- Never assume skill availability
- Never re-implement existing skills

---

## 4. GRAPH EXECUTION MODEL

### 4.1 Node Types
- job-description-analyzer
- resume-tailor
- resume-bullet-writer
- resume-quantifier
- resume-ats-optimizer
- resume-formatter
- career-changer-translator

---

### 4.2 Execution Entry Point (CRITICAL)
main.tex + JD → job-description-analyzer

---

### 4.3 Edge Model (logical flow)
job-description-analyzer → resume-tailor  
resume-tailor → resume-bullet-writer  
resume-bullet-writer → resume-quantifier  
resume-quantifier → resume-ats-optimizer  
resume-ats-optimizer → resume-formatter  

---

## 5. EXECUTION STRATEGY (GRAPH MODE)

Nodes execute based on:
- relevance score
- dependency weight
- missing capability signals

Parallel execution allowed for:
- resume-bullet-writer
- resume-quantifier
- resume-ats-optimizer

Merge happens at final stage.

---

## 6. EXECUTION MODES (DECISION TREE)

IF no JD:
→ GENERAL MODE

IF JD exists:
→ TARGETED MODE

IF career switch:
→ TRANSITION MODE

---

## 7. COMPANY INTELLIGENCE LAYER (STRICT)

If company is mentioned:

Step 1:
- Use search tool for verified developments only

Step 2:
- Validate:
  - must appear in official source OR multiple sources

Step 3:
- Convert to alignment signals ONLY:
  - do NOT add new experience
  - do NOT fabricate involvement

---

## 8. CONFLICT RESOLUTION RULES
- resume-formatter ALWAYS runs last
- resume-tailor overrides bullet structure changes
- resume-quantifier cannot modify factual claims
- no two skills modify same field without merge resolution

---

## 9. OUTPUT COMPRESSION RULE
- Remove redundant phrasing
- Each bullet must add unique signal
- Minimize repetition across sections

---

## 10. SKILL FIND RULE
If capability missing:
- call find-skill
- select best match
- delegate execution

Never fallback to manual implementation if skill exists

---

## 11. OUTPUT SPECIFICATION (STRICT ARTIFACT BINDING)

Return:

1. resume.tex (  `<company_name>_<role_name>.tex`)
   - final transformed resume

2. change-report-format.md
   - structured explanation of modifications

---

## 12. CORE PRINCIPLE

This system is a:
> deterministic, evidence-bound, graph-executed resume optimization engine

NOT a generator.
NOT a prompt chain.

---

## 13. EXAMPLES

See the `examples/` directory for a single deterministic transformation:

- `examples/input.tex` — master resume (main.tex equivalent)
- `examples/jd.md` — job description input
- `examples/output.tex` — final tailored resume
- `examples/change_report.md` — explanation of modifications and reasoning

---

## 14. REFERENCES

- `references/change-report-format.md` — Full change report specification (layout, sections, diff formatting)