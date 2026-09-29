# Processing Pipeline Deep-Dive

Detailed documentation of the 7-step processing pipeline that runs after every substantive conversation.

## Table of Contents
- [Overview](#overview)
- [Step 1: Extraction](#step-1-extraction)
- [Step 2: Deduplication](#step-2-deduplication)
- [Step 3: Validation](#step-3-validation)
- [Step 4: Relationship Discovery](#step-4-relationship-discovery)
- [Step 5: Confidence Calibration](#step-5-confidence-calibration)
- [Step 6: Graph Evolution](#step-6-graph-evolution)
- [Step 7: Change Log](#step-7-change-log)
- [When to Skip Processing](#when-to-skip-processing)
- [Examples](#examples)

---

## Overview

The pipeline transforms conversation content into durable knowledge stored in the graph. It runs **automatically** after every conversation — no keyword required.

### Trigger Conditions

| Event | What Happens |
|-------|---------------|
| **Conversation start** | Retrieve relevant memories via `retrieval.py retrieve` before responding |
| **Conversation end** | Run full pipeline (extract → deduplicate → validate → discover → calibrate → evolve → log) |

### Pipeline Layers

1. **AI-driven steps** (1–4): The AI agent uses its intelligence to extract, deduplicate, validate, and discover relationships
2. **Deterministic steps** (5–7): Scripts apply rules for confidence calibration, tier lifecycle, and change logging

```
Conversation Start → [Retrieve relevant memories] → Respond informed by memory
Conversation End   → [AI: Extract] → [AI: Deduplicate] → [AI: Validate]
     → [AI: Discover Relationships] → [Script: Calibrate Confidence]
     → [Script: Tier Lifecycle] → [Script: Log Changes] → Updated Graph
     → [Generate visualization] → 🧠 Memory updated — [View your Memory Graph]
```

---

## Step 1: Extraction

**Goal**: Capture durable, reusable knowledge only.

### What to Extract

| Category | Examples | Confidence Range |
|----------|----------|-----------------|
| Preferences | "I prefer dark mode", "I like functional programming" | 70–90% |
| Skills | "I know Python well", "I'm learning Rust" | 60–95% |
| Goals | "I want to become a tech lead", "I'm building a SaaS" | 70–85% |
| Habits | "I code in the morning", "I review PRs on Fridays" | 60–80% |
| Decisions | "We chose PostgreSQL for the DB", "I'm using Next.js" | 80–95% |
| Relationships | "Alice is my manager", "Bob is my pair programming partner" | 70–90% |
| Projects | "Working on an e-commerce platform", "Building a CLI tool" | 80–95% |
| Learning | "Reading Designing Data-Intensive Applications", "Taking a course on distributed systems" | 75–90% |
| Experiences | "I migrated a monolith to microservices", "I've worked at a startup" | 80–95% |
| Knowledge | "Redis uses a single-threaded model", "GraphQL subscriptions use WebSockets" | 70–90% |

### What to Skip

- Greetings and pleasantries ("hello", "thanks", "bye")
- One-time instructions ("use tabs not spaces in this file")
- Transient context ("it's raining today", "it's January 2024")
- Information explicitly marked as temporary
- Simple factual lookups ("what's the syntax for X?") — unless the user's learning pattern is itself worth remembering
- Corrections that don't reveal a preference or knowledge

### Extraction Quality Checklist

For each potential memory, verify:
- [ ] Is this reusable in future conversations?
- [ ] Would the user want me to remember this in 6 months?
- [ ] Does this reveal something about the user, not just the topic?
- [ ] Is there enough context to understand why this matters?
- [ ] Can I provide specific evidence (a quote or observation)?

### How to Extract

When analyzing a conversation:

1. **Read the full conversation** — don't just look at the last message
2. **Identify durable knowledge** — facts, preferences, skills, goals, habits, decisions
3. **For each memory**, write:
   - A clear, concise title
   - A one-sentence summary
   - A detailed description with context
   - The category and subcategory
   - A confidence score (how certain are you?)
   - An importance score (how central to the user?)
   - Specific evidence (quotes from the conversation)
   - Tags (both what the user would search for and what you infer)

4. **Format as JSON** matching the [Processing Input Schema](schemas.md#processing-input-schema)

5. **Pass to processor.py**:
   ```bash
   echo '<json>' | python scripts/processor.py process --graph memory/graph.json
   ```

---

## Step 2: Deduplication

**Goal**: Avoid creating duplicate nodes. Update/merge/strengthen instead.

### Process

1. For each extracted memory, search the existing graph:
   ```bash
   python scripts/retrieval.py search --query "memory title and summary" --graph memory/graph.json
   ```

2. Evaluate matches:
   - **Title match >80%**: Likely same concept → update existing
   - **Summary overlap >60%**: Probably same concept → update or merge
   - **Same category + similar tags**: Possibly same → investigate further
   - **No significant match**: Create new node

3. If a match is found, determine the relationship:
   - **Same concept, new info**: Update the existing node
   - **Same concept, confirming info**: Strengthen confidence, add evidence
   - **Same concept, contradicting info**: Lower confidence of old, possibly create new
   - **Different concept despite surface similarity**: Create new node with `Similar To` edge

### Deduplication Rules

| Scenario | Action |
|----------|--------|
| Exact same fact restated | Add evidence to existing, +5–10% confidence |
| Same fact with new detail | Update description, add evidence |
| Same fact with higher certainty | Update confidence, note source |
| Same fact contradicted | Lower old confidence, flag for review |
| Similar but distinct concept | Create new node, add `Similar To` edge |

---

## Step 3: Validation

**Goal**: Determine how new information relates to existing knowledge.

### Validation Actions

| Action | When to Use | Effect |
|--------|-------------|--------|
| **Confirms** | New info agrees with existing | Strengthen confidence +5–15% |
| **Expands** | New info adds detail to existing | Update description, add evidence |
| **Contradicts** | New info conflicts with existing | Lower confidence −10–20%, flag |
| **Replaces** | New info supersedes existing | Mark old as Superseded, create new |
| **Specializes** | New info is a specific case | Create child node with `Derived From` edge |

### Contradiction Handling

When new information contradicts existing knowledge:

1. **Don't immediately overwrite** — both versions might be valid in different contexts
2. **Lower confidence** of the existing node by 10–20%
3. **Create a new node** with the contradicting information
4. **Add a `Contradicts` edge** between them
5. **Add evidence** to both nodes explaining the contradiction
6. **Flag for user review** if confidence drops below 40%

Example:
```
Existing: "User prefers PostgreSQL" (confidence: 85%)
New: "User chose MongoDB for the new project"

Action:
- Lower PostgreSQL preference to 65%
- Create new node: "Chose MongoDB for Project X" (confidence: 80%)
- Add Contradicts edge with explanation
- Note: "User may use different DBs for different projects"
```

---

## Step 4: Relationship Discovery

**Goal**: Find connections between new and existing nodes.

### Process

1. **Direct connections**: Look for obvious topical or causal links
   - Same category → `Related To`
   - One causes/enables the other → `Causes`/`Enables`
   - One depends on the other → `Depends On`

2. **Indirect connections**: Find nodes that share neighbors
   - Use `graph_ops.py find-connections` to find candidates
   - Only create edges above confidence threshold (≥60%)

3. **Role-type connections**: Connect to identity nodes
   - Is this a goal? → `Goal` edge
   - Is this a project? → `Project` edge
   - Is this a preference? → `Preference` edge
   - Is this a skill? → `Skill` edge

### Relationship Rules

- Every edge must have an explanation
- Never add an unexplained edge
- Prefer specific relationship types over generic `Related To`
- Confidence threshold for inferred connections: ≥60%
- Don't create circular dependency chains

### Example

New memory: "User is learning Rust for systems programming"

Connections to discover:
- `Skill` edge to existing "Systems Programming" node
- `Learning` edge to existing "Rust" node (if exists)
- `Related To` edge to existing "Performance Optimization" interest
- `Builds Upon` edge to existing "C/C++ Experience" node

---

## Step 5: Confidence Calibration

**Goal**: Adjust confidence scores based on new evidence.

### Calibration Table

| Event | Delta | Notes |
|-------|-------|-------|
| User explicitly confirms | +15–25% | Strongest signal |
| Reinforced by new conversation | +5–15% | Supporting evidence |
| Contradicted by new info | −10–20% | Conflicting evidence |
| Contradicted by user explicitly | −30–50% or Superseded | User knows best |
| Long period without access | −2–5% per month | Decay over time (floor: 20%) |
| Multiple consistent sources | Cap at 95% | Never 100% certainty |

### Rules

- **Gradual changes**: Don't swing more than 25% in one update
- **Floor at 0%**, ceiling at 95% (never absolute certainty)
- **Track reason**: Every confidence change must be logged with a reason
- **Version history**: Old confidence values are preserved in version_history

### Implementation

The processor.py script handles calibration automatically when you pass the event type:

```bash
python scripts/processor.py calibrate --node-id <uuid> --event user_confirmed --graph memory/graph.json
```

---

## Step 6: Tier Lifecycle (Graph Evolution)

**Goal**: Let the graph grow and change organically, with tier-aware lifecycle management.

### Tier Transition Rules

| Current Tier | Promotion Rule | Decay/Archive Rule |
|--------------|----------------|--------------------|
| **Instant** | Promote to Short-Term if durable and reusable | Discard at conversation end if not promoted |
| **Short-Term** | Promote to Long-Term if referenced ≥3×, or high-importance (≥7), or old enough with good confidence | Decay on forgetting curve after `short_term_decay_days`; archive if confidence hits 0 |
| **Long-Term** | Already consolidated | Dormant after 90d; slow decay; archive only after 365d + low importance |

### Evolution Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| **Promote** | Tier promotion rules met | `tier` field changes, logged in changelog |
| **Strengthen** | Frequently accessed, well-evidenced | Increase confidence, importance |
| **Weaken** | Unused or contradicted | Decrease confidence |
| **Split** | Node covers too many concepts | Create multiple focused nodes |
| **Merge** | Redundant nodes | Consolidate into one |
| **Dormant** | Long-Term + 90d no access | Status → Dormant |
| **Archive** | Short-Term decayed to 0, or Long-Term extreme disuse + low importance | Status → Archived |
| **Supersede** | Replaced by better info | Status → Superseded, link to replacement |

### Critical Rules

- **Never silently delete Long-Term nodes** — dormancy/archival must be reversible and visible in version history
- **Every tier transition is logged** with the trigger, confidence before/after, and affected relationships
- **Config-driven thresholds** — all decay windows and promotion rules read from `memory/config.json`

```bash
python scripts/processor.py evolve --graph memory/graph.json
```

### Splitting Criteria

Split a node when:
- It covers 3+ distinct sub-concepts
- Different parts have different confidence levels
- Users would benefit from more granular retrieval

### Merging Criteria

Merge nodes when:
- They represent the same concept with different wording
- They have overlapping evidence
- Retrieval would benefit from consolidation

---

## Step 7: Change Log

**Goal**: Record every modification for auditability and rollback.

### What to Log

Every modification gets an entry with:
- **Timestamp**: When the change happened
- **Action**: What type of change
- **Target**: Which node or edge was affected
- **Changes**: Specific fields that changed (old → new values)
- **Reason**: Why the change was made
- **Confidence impact**: How confidence was affected
- **Affected relationships**: Which edges were impacted

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "update_node",
  "target_id": "550e8400-...",
  "changes": {
    "confidence": { "old": 70, "new": 85 },
    "evidence": { "added": ["User confirmed in conversation"] }
  },
  "reason": "User explicitly confirmed their preference",
  "confidence_impact": "+15%",
  "affected_relationships": ["770e8400-..."]
}
```

### Accessing the Log

```bash
python scripts/graph_ops.py changelog --graph memory/graph.json --limit 20
```

---

## When to Skip Processing

Skip the pipeline for:
- Greetings and pleasantries
- Simple factual lookups with no reusable knowledge
- One-time file edits or code fixes
- Transient context (weather, time, temporary state)
- Conversations where the user explicitly says "don't remember this"

---

## Examples

### Example 1: Preference Extraction

**Conversation:**
> User: "I always use dark themes in my editors. Light themes give me headaches after a few hours."
> AI: "I'll note that preference. What editors do you use?"
> User: "VS Code mainly, sometimes Vim. I've set up my terminal with a dark color scheme too."

**Extracted Memory:**
```json
{
  "title": "Prefers dark themes",
  "summary": "User consistently uses dark themes across all development tools",
  "description": "User strongly prefers dark themes in editors, terminals, and all development tools. Light themes cause headaches after extended use. Uses dark themes in VS Code, Vim, and terminal.",
  "category": "Preferences",
  "subcategory": "UI/UX",
  "confidence": 85,
  "importance": 6,
  "evidence": [
    "User said: 'I always use dark themes in my editors'",
    "User said: 'Light themes give me headaches after a few hours'",
    "User confirmed dark theme in VS Code, Vim, and terminal"
  ],
  "tags": {
    "user": ["dark-mode", "editors"],
    "ai": ["ergonomics", "visual-comfort", "ui-preference"]
  },
  "relationships": [
    {
      "target_title": "VS Code",
      "type": "Preference",
      "explanation": "User's primary editor with dark theme",
      "confidence": 90
    }
  ]
}
```

### Example 2: Skill Update

**Conversation:**
> User: "I've been using Rust for about 6 months now. I'm getting comfortable with the borrow checker."
> (Existing node: "Learning Rust" with confidence 60%)

**Processing Result:**
- Deduplication: Found "Learning Rust" node
- Validation: Expands existing knowledge (6 months experience, borrow checker comfort)
- Action: Update existing node, increase confidence to 75%
- New evidence added: "6 months experience", "comfortable with borrow checker"

### Example 3: Contradiction

**Conversation:**
> User: "Actually, I've switched from PostgreSQL to MongoDB for the analytics project. The schema flexibility is better for our use case."
> (Existing node: "Prefers PostgreSQL" with confidence 80%)

**Processing Result:**
- Deduplication: Found "Prefers PostgreSQL" node
- Validation: Contradicts existing knowledge
- Action:
  1. Lower PostgreSQL preference confidence to 60%
  2. Create new node: "Chose MongoDB for analytics project" (confidence: 85%)
  3. Add `Contradicts` edge with explanation
  4. Note: User may prefer different DBs for different use cases
