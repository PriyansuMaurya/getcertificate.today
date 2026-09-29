---
name: memory-graph
description: Build and maintain a persistent Memory Graph that learns from every conversation. Treats memory as a knowledge ecosystem — nodes connected by typed relationships with confidence, provenance, and version history. This skill runs automatically on every conversation (no keyword required). Use this skill whenever the user wants to remember something, recall past knowledge, see their memory graph, understand their knowledge patterns, explore connections between ideas, or when a conversation contains durable knowledge worth preserving. Also triggers when the user mentions memory, knowledge graph, remembering, recalling, memory visualization, or wants to see what you know about them. Even casual mentions like "remember this" or "what do you know about X" should trigger this skill.
---

# Memory Graph

A living cognitive knowledge graph that acts as the user's external memory. Every memory lives inside a network of relationships, evidence, confidence, and provenance — the graph gets more accurate and useful through refinement, not just accumulation.

## Trigger Conditions (Automatic)

The memory pipeline is **not optional** and **not keyword-gated**. It runs automatically on two events:

### Conversation Start
Before responding, pull relevant nodes so the reply is informed by prior memory:
```bash
python scripts/retrieval.py retrieve --query "<derived from user's first message>" --graph memory/graph.json --top-k 10
```
Use the results to inform your response. State which memories shaped your answer when relevant.

### Conversation End
After the final exchange, run the full Processing Pipeline against everything said:
1. Extract durable knowledge from the conversation
2. Feed extracted memories to `processor.py process`
3. Surface the end-of-conversation output (see below)

No user phrase like "remember this" should be required. Every conversation is a source of potential memory, filtered by the Extraction step's rule: durable and reusable only.

### End-of-Conversation Output
At the close of **every** conversation, after the memory pipeline runs, surface this line:

> 🧠 Memory updated — [View your Memory Graph](memory/graph.html)

Generate the visualization first if needed:
```bash
python scripts/visualizer.py --graph memory/graph.json --output memory/graph.html
```

This should reflect the graph after this conversation's updates (new nodes, promotions, decayed/archived nodes). Even if no changes occurred, still show the link — "no changes" is a valid, loggable outcome.

## Core Principles

The system is: **persistent** (survives across sessions), **explainable** (every node and edge has provenance), **auditable** (full change history), **versioned** (nothing is lost), **self-organizing** (nodes strengthen/weaken/archive naturally), **incrementally improving** (confidence calibrates over time), **retrieval-efficient** (semantic + graph traversal), **human-readable** (clear titles and summaries), **non-destructive** (never overwrite silently), **evidence-driven** (claims require evidence), **privacy-aware** (only store what the user would want stored), and **graph-native** (relationships are first-class citizens).

**Never overwrite silently.** Preserve history, provenance, and superseded knowledge.

## Storage Structure

All memory data lives in a `memory/` directory at the project root:

```
memory/
├── graph.json          # The complete graph (nodes + edges)
├── config.json         # Tunable thresholds (tier decay, promotion rules)
├── embeddings.json     # Semantic embedding references (optional)
└── snapshots/          # Periodic graph snapshots for time-travel
```

Initialize with `python scripts/graph_ops.py init` if the directory doesn't exist.

## Memory Tiers (Human-Like Model)

Every node lives in exactly one tier at a time and moves between tiers based on rules. This mirrors how human memory works: working memory → recent → consolidated.

### Instant Memory (Working Memory)
- **Scope**: Current conversation only
- **Holds**: Raw statements, in-progress reasoning, anything not yet evaluated
- **Lifespan**: Discarded at conversation end unless promoted to Short-Term
- **Promotion rule**: Promote if the info is durable and reusable per the Extraction step
- **Implementation**: Instant Memory exists only in the AI's working context during a conversation — it is **never written to the graph**. The AI decides at conversation end which Instant memories are durable enough to promote to Short-Term by passing them to `processor.py process`.

### Short-Term Memory (Recent, Unconsolidated)
- **Scope**: Days to a few weeks
- **Holds**: Newly promoted nodes — facts, preferences, or events mentioned once or a few times
- **Default confidence**: Moderate; not yet reinforced
- **Decay rule**: If not referenced, confirmed, or connected within ~2-4 weeks, confidence drops on a forgetting curve (steep at first, flattening) until archived
- **Consolidation rule**: Promote to Long-Term when independently confirmed, repeatedly referenced, or judged high-importance (e.g. a stated goal, named project, core preference)

### Long-Term Memory (Consolidated, Durable)
- **Scope**: Indefinite
- **Holds**: Consolidated facts, ongoing goals/projects, stable preferences, recurring patterns
- **Decay rule**: Much slower and never silent-delete — status moves to Dormant (unused but retained). Only archives after prolonged disuse plus low importance. Superseded nodes always retain lineage.
- **Reinforcement rule**: Every time a Long-Term node is referenced or confirmed, its confidence and "last verified" timestamp update — same principle as spaced repetition.

### Node Lifecycle
```
Instant → (promoted) → Short-Term → (consolidated) → Long-Term
Short-Term → (unused, decayed) → Archived
Long-Term → (unused) → Dormant → (still unused) → Archived
```

Every tier transition is logged in the changelog with the trigger and confidence before/after.

### Config-Driven Thresholds

Tier and decay logic is driven by `memory/config.json`. Key settings:

```json
{
  "instant_promotion_min_confidence": 60,
  "short_term_consolidation_references": 3,
  "short_term_consolidation_days": 14,
  "short_term_decay_days": 21,
  "short_term_decay_rate_per_day": 2.0,
  "long_term_dormant_days": 90,
  "long_term_archive_days": 365,
  "long_term_decay_rate_per_month": 1.0
}
```

Tune these without rewriting any pipeline code.

## Memory Node Model

Each node represents one durable concept — a fact, preference, skill, goal, habit, decision, relationship, or experience that's worth remembering long-term.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Immutable identifier, generated once |
| `title` | string | Short, human-readable label (≤80 chars) |
| `summary` | string | One-sentence overview |
| `description` | string | Full context and details |
| `category` | string | Primary knowledge domain (see below) |
| `subcategory` | string | More specific classification |
| `confidence` | 0–100 | How certain we are this is accurate |
| `importance` | 1–10 | How central to the user's life/goals |
| `created_at` | ISO timestamp | When first created |
| `last_modified` | ISO timestamp | Most recent update |
| `last_accessed` | ISO timestamp | Most recent retrieval |
| `retrieval_frequency` | int | How often this has been retrieved |
| `sources` | string[] | Conversation IDs or descriptions where this came from |
| `evidence` | string[] | Specific quotes or observations supporting this |
| `version_history` | array | Past states with timestamps and reasons for change |
| `embedding_ref` | string | Reference to semantic embedding (if available) |
| `related_entities` | string[] | IDs of directly connected nodes |
| `tags` | object | `{ user: [], ai: [] }` — user-provided and AI-inferred tags |
| `status` | enum | Active / Dormant / Archived / Superseded / Unverified |

### Status Lifecycle

- **Active**: Currently relevant, frequently accessed
- **Dormant**: Still accurate but rarely accessed (auto after 90 days of no retrieval)
- **Archived**: No longer relevant but preserved for history
- **Superseded**: Replaced by newer, more accurate information
- **Unverified**: Extracted but not yet confirmed by evidence

### Confidence Calibration

Confidence changes gradually, not abruptly:

| Event | Change |
|-------|--------|
| User explicitly confirms | +15–25% |
| Reinforced by new conversation | +5–15% |
| Contradicted by new info | −10–20% |
| Contradicted by user explicitly | −30–50% or set to Superseded |
| Long period without access | −2–5% per month (floor: 20%) |
| Multiple consistent sources | Cap at 95% (never 100%) |

## Relationship Model

Typed edges connect nodes. Each edge is a first-class citizen with its own metadata.

### Relationship Types

**Semantic relationships:**
- `Related To` — general topical connection
- `Supports` — one fact provides evidence for another
- `Contradicts` — conflicting information
- `Similar To` — overlapping but distinct concepts
- `Opposite Of` — inverse or contrasting concepts

**Causal/dependency relationships:**
- `Depends On` — one requires the other
- `Causes` — one leads to the other
- `Enables` — one makes the other possible
- `Requires` — necessary condition
- `Blocks` — one prevents the other

**Developmental relationships:**
- `Derived From` — evolved from a prior concept
- `Builds Upon` — extends or elaborates
- `Improves` — makes better in some dimension
- `Influences` — shapes thinking or decisions

**Role-type edges** (connect memories to identity):
- `Goal`, `Project`, `Preference`, `Interest`, `Habit`, `Skill`, `Person`, `Experience`

### Edge Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Immutable identifier |
| `source` | UUID | Source node ID |
| `target` | UUID | Target node ID |
| `type` | enum | Relationship type from above |
| `confidence` | 0–100 | How certain this relationship exists |
| `strength` | 0–100 | How strong the connection is |
| `direction` | enum | `directed` or `undirected` |
| `created_at` | ISO timestamp | When first created |
| `last_verified` | ISO timestamp | Most recent confirmation |
| `evidence` | string[] | What supports this relationship |
| `explanation` | string | Plain-language description of the connection |
| `usage_frequency` | int | How often this edge has been traversed |

## Knowledge Domains

A memory can belong to multiple domains simultaneously. Use the most specific applicable domain.

| Domain | What It Captures |
|--------|-----------------|
| **Career** | Job roles, professional goals, workplace dynamics, industry knowledge |
| **Learning** | Courses, tutorials, books, skills being developed, knowledge gaps |
| **Research** | Papers, findings, methodologies, open questions, hypotheses |
| **Projects** | Active/past projects, architecture decisions, technical choices, deadlines |
| **Skills** | Programming languages, tools, frameworks, soft skills, proficiency levels |
| **Preferences** | Coding style, tool choices, workflow preferences, aesthetic tastes |
| **Habits** | Work routines, coding patterns, communication style, recurring behaviors |
| **Decisions** | Choices made, rationale, trade-offs considered, alternatives rejected |
| **Relationships** | Colleagues, collaborators, mentors, team dynamics, professional network |
| **Personal Knowledge** | Health, finance, life lessons, personal philosophy, values |
| **Long-term Goals** | Career aspirations, learning objectives, life goals, vision statements |

## Processing Pipeline

Run this pipeline after every substantive conversation. Skip trivial exchanges (greetings, simple lookups, one-off questions with no reusable knowledge).

Use `python scripts/processor.py process --graph memory/graph.json` to run the full pipeline, or execute steps manually for more control.

### Step 1: Extraction

Extract durable, reusable knowledge only. Ask yourself: "Would this be useful in a conversation 6 months from now?"

**Extract:**
- Stated preferences, opinions, and values
- Skills, knowledge, and expertise mentioned
- Goals, plans, and aspirations
- Decisions and their rationale
- Recurring patterns and habits
- Important relationships and people
- Technical choices and architecture decisions
- Lessons learned and insights
- Project details and status

**Skip:**
- Greetings and pleasantries
- One-time instructions or corrections
- Transient context (current weather, today's date)
- Information the user explicitly marks as temporary
- Repetitions of already-stored knowledge (update instead)

### Step 2: Deduplication

Before creating a new node, search for semantic matches in the existing graph.

```bash
python scripts/retrieval.py search --query "candidate memory text" --graph memory/graph.json
```

If a match is found:
- **Same concept, updated info**: Update the existing node, add to version history
- **Same concept, confirming info**: Strengthen confidence, add evidence
- **Same concept, contradicting info**: Lower confidence of old, create new with higher confidence, mark old as Superseded if user confirms
- **Different concept**: Create new node

### Step 3: Validation

Determine how new information relates to existing knowledge:

- **Confirms**: New info agrees with existing → strengthen confidence
- **Expands**: New info adds detail to existing → update description, add evidence
- **Contradicts**: New info conflicts with existing → lower confidence, flag for review
- **Replaces**: New info supersedes existing → mark old as Superseded, create new
- **Specializes**: New info is a specific case of existing → create child node with `Derived From` edge

### Step 4: Relationship Discovery

Find connections between new and existing nodes:

1. **Direct connections**: Obvious topical or causal links
2. **Indirect connections**: Nodes that share neighbors or domains
3. **Inferred connections**: Latent relationships above confidence threshold (≥60%)

Every edge must have an explanation. Never add an unexplained edge.

```bash
python scripts/graph_ops.py find-connections --node-id <uuid> --graph memory/graph.json
```

### Step 5: Confidence Calibration

Adjust confidence scores based on new evidence:

- Use the calibration table above (Memory Node Model → Confidence Calibration)
- Changes should be gradual — don't swing more than 25% in one update
- Track the reason for every confidence change in version history
- Multiple independent sources supporting the same fact → cap at 95%

### Step 6: Graph Evolution

The graph is a living structure. Over time:

- **Strengthen**: Frequently accessed, well-evidenced nodes grow stronger
- **Weaken**: Unused or contradicted nodes lose confidence
- **Split**: A node covering too many concepts becomes multiple nodes
- **Merge**: Redundant nodes consolidate into one
- **Archive**: No longer relevant nodes move to Archived status
- **Supersede**: Replaced nodes link to their replacement

Always preserve full lineage — the version history tells the story of how understanding evolved.

### Step 7: Change Log

Every modification gets an entry in `memory/changelog.json`:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "update_node",
  "target_id": "uuid-of-node",
  "changes": {
    "confidence": { "old": 70, "new": 85 },
    "evidence": { "added": ["User confirmed in conversation"] }
  },
  "reason": "User explicitly confirmed their preference for dark mode",
  "confidence_impact": "+15%",
  "affected_relationships": ["edge-uuid-1", "edge-uuid-2"]
}
```

## Retrieval Strategy (Scoped, Tier-Aware)

The agent must never scan the whole graph to answer a query. Retrieval is targeted, not exhaustive.

### Step 1: Query First, Traverse Second

Derive a semantic/keyword query from the current task, hit an index to get a small candidate set, then expand outward only from those nodes (1st/2nd-degree neighbors) — never a full-graph walk.

```bash
python scripts/retrieval.py retrieve --query "what the user is asking about" --graph memory/graph.json --top-k 10
```

### Step 2: Tier-Aware Shortcut

Check Instant/Short-Term (current + recent context) first since it's small and cheap. Only reach into Long-Term when the task actually needs durable/background knowledge (e.g. stated goals, standing preferences, past projects). The retrieval script does this automatically.

### Step 3: Cap the Candidate Set

Pull the top-N relevant nodes by the ranking rule, not "everything above some threshold" — bounded retrieval keeps responses fast and grounded. Default cap: 20 candidates (configurable in `memory/config.json`).

### Step 4: Skip Irrelevant Domains

If the task is clearly scoped to one domain (e.g. "Career"), pass `--exclude-categories` to skip unrelated domains (e.g. "Habits") unless a discovered relationship bridges them.

### Step 5: Ranking

Score each candidate by combining:

| Factor | Weight | Description |
|--------|--------|-------------|
| Semantic relevance | 30% | How closely the content matches the query |
| Confidence | 25% | How certain we are the memory is accurate |
| Recency | 20% | How recently the memory was accessed or modified |
| Importance | 15% | How central to the user's goals |
| Relationship strength | 10% | How strongly connected to other relevant memories |

### Step 6: Citation and Logging

Always state which memories shaped your response. The retrieval output includes a `retrieval_log` showing exactly which nodes were used and why.

> "Based on your preference for functional programming (confidence: 85%, last discussed Jan 10) and your current project using Elixir (confidence: 90%, active), I'd recommend..."

Distinguish observed facts from inferred conclusions.

## Visualization

Generate an interactive force-directed graph visualization:

```bash
python scripts/visualizer.py visualize --graph memory/graph.json --output memory/graph.html
```

### Visual Mappings

| Property | Maps To |
|----------|---------|
| Node size | Importance (1–10) |
| Node color | Category (each domain has a distinct color) |
| Node border | Confidence (thicker = higher) |
| Node glow | Recent activity (brighter = more recent) |
| Edge thickness | Strength (0–100) |
| Edge color | Relationship type |
| Edge opacity | Confidence |
| Distance | Semantic similarity (closer = more similar) |

### Interactions

- **Zoom/Pan**: Navigate the graph space
- **Search**: Find nodes by title, tag, or content
- **Focus mode**: Click a node to highlight its neighborhood
- **Multi-select**: Shift+click to select multiple nodes
- **Filter**: By confidence, category, importance, date, relationship type
- **Timeline replay**: Watch the graph evolve over time
- **Expand/collapse**: Show or hide node clusters
- **Shortest path**: Find the connection path between two nodes
- **N-degree neighborhood**: Show all nodes within N hops
- **Version comparison**: Compare graph states at different points in time

## Continuous Intelligence

Periodically analyze the graph to surface insights. Run this when the user asks "what do you know about me" or "show me my patterns":

```bash
python scripts/graph_ops.py analyze --graph memory/graph.json
```

### What to Surface

- **Recurring themes**: Clusters of related, high-frequency nodes
- **Emerging interests**: New nodes forming clusters in a domain
- **Evolving expertise**: Skills with increasing confidence over time
- **Knowledge gaps**: Domains with few or low-confidence nodes
- **Forgotten commitments**: Goals or projects with declining activity
- **Conflicting memories**: Nodes with Contradicts edges needing resolution
- **Redundant memories**: Nodes that could be merged
- **Weakly connected clusters**: Isolated groups that might relate to others
- **Central nodes**: High-degree nodes that connect many concepts
- **Bridge nodes**: Nodes that connect otherwise separate clusters

Every insight must include: explanation, supporting evidence, and confidence estimate.

## Quick Reference

### Common Operations

```bash
# Initialize memory directory
python scripts/graph_ops.py init

# Process a conversation (run after each chat)
python scripts/processor.py process --graph memory/graph.json

# Search for relevant memories
python scripts/retrieval.py retrieve --query "search terms" --graph memory/graph.json

# Add a specific memory manually
python scripts/graph_ops.py add-node --title "..." --summary "..." --category "..." --graph memory/graph.json

# Find connections for a node
python scripts/graph_ops.py find-connections --node-id <uuid> --graph memory/graph.json

# Generate visualization
python scripts/visualizer.py visualize --graph memory/graph.json --output memory/graph.html

# Analyze graph for insights
python scripts/graph_ops.py analyze --graph memory/graph.json

# Create a snapshot
python scripts/graph_ops.py snapshot --graph memory/graph.json

# View changelog
python scripts/graph_ops.py changelog --graph memory/graph.json --limit 20
```

## Detailed References

For deeper documentation, read these files as needed:

- `references/schemas.md` — Complete JSON schemas for all data structures
- `references/pipeline.md` — Detailed processing pipeline with examples
- `references/domains.md` — Knowledge domain definitions with examples and edge cases
