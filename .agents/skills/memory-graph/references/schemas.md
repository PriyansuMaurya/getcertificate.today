# Memory Graph Schemas

Complete JSON schemas for all data structures used in the Memory Graph system.

## Table of Contents
- [Graph Structure](#graph-structure)
- [Node Schema](#node-schema)
- [Edge Schema](#edge-schema)
- [Changelog Entry Schema](#changelog-entry-schema)
- [Processing Input Schema](#processing-input-schema)
- [Retrieval Result Schema](#retrieval-result-schema)

---

## Graph Structure

The top-level `graph.json` file contains:

```json
{
  "metadata": {
    "created_at": "2024-01-15T10:00:00Z",
    "last_modified": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "node_count": 42,
    "edge_count": 67
  },
  "nodes": {
    "<uuid>": { /* Node Schema */ },
    "<uuid>": { /* Node Schema */ }
  },
  "edges": {
    "<uuid>": { /* Edge Schema */ },
    "<uuid>": { /* Edge Schema */ }
  },
  "_changelog": [
    { /* Changelog Entry */ }
  ]
}
```

---

## Node Schema

Each node represents one durable concept in the knowledge graph.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Prefers functional programming",
  "summary": "User strongly prefers functional programming paradigms over OOP",
  "description": "In multiple conversations, the user has expressed a preference for functional programming. They find immutable data structures easier to reason about and prefer pure functions. They've used Haskell, Elixir, and Clojure professionally.",
  "category": "Preferences",
  "subcategory": "Programming Paradigms",
  "confidence": 85,
  "importance": 7,
  "created_at": "2024-01-10T08:00:00Z",
  "last_modified": "2024-01-15T10:30:00Z",
  "last_accessed": "2024-01-15T10:30:00Z",
  "retrieval_frequency": 12,
  "sources": [
    "conversation-2024-01-10",
    "conversation-2024-01-12",
    "conversation-2024-01-15"
  ],
  "evidence": [
    "User said: 'I always reach for functional patterns first'",
    "User chose Elixir for the new project specifically for its functional nature",
    "User rejected a class-heavy Python solution in favor of a functional approach"
  ],
  "version_history": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Prefers functional programming",
      "summary": "User prefers functional programming paradigms",
      "confidence": 70,
      "snapshot_at": "2024-01-10T08:00:00Z"
    }
  ],
  "embedding_ref": "embeddings/550e8400.json",
  "related_entities": [
    "660e8400-e29b-41d4-a716-446655440001",
    "660e8400-e29b-41d4-a716-446655440002"
  ],
  "tags": {
    "user": ["coding-style", "personal-prefs"],
    "ai": ["functional", "paradigm", "immutability"]
  },
  "status": "Active"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID string | Yes | Immutable identifier, generated once at creation |
| `title` | string (≤80 chars) | Yes | Short, human-readable label |
| `summary` | string | Yes | One-sentence overview of the concept |
| `description` | string | Yes | Full context, details, and supporting information |
| `category` | enum string | Yes | Primary knowledge domain (see domains.md) |
| `subcategory` | string | No | More specific classification within the domain |
| `confidence` | integer 0–100 | Yes | How certain we are this memory is accurate |
| `importance` | integer 1–10 | Yes | How central this is to the user's life/goals |
| `created_at` | ISO 8601 string | Yes | When the node was first created |
| `last_modified` | ISO 8601 string | Yes | Most recent update to any field |
| `last_accessed` | ISO 8601 string | Yes | Most recent retrieval or reference |
| `retrieval_frequency` | integer ≥0 | Yes | Total number of times this node has been retrieved |
| `sources` | string[] | Yes | Conversation IDs or descriptions where this originated |
| `evidence` | string[] | Yes | Specific quotes or observations supporting this memory |
| `version_history` | array of snapshots | Yes | Past states with timestamps (full node snapshots) |
| `embedding_ref` | string | No | Path to semantic embedding file (if available) |
| `related_entities` | UUID string[] | Yes | IDs of directly connected nodes |
| `tags` | object | Yes | User-provided and AI-inferred tags |
| `tags.user` | string[] | Yes | Tags explicitly given by the user |
| `tags.ai` | string[] | Yes | Tags inferred by the AI |
| `status` | enum string | Yes | Current lifecycle status |
| `tier` | enum string | Yes | Memory tier: `Instant`, `Short-Term`, or `Long-Term` |
| `tier_history` | array | Yes | History of tier transitions with timestamps and reasons |

### Status Values

| Status | Meaning |
|--------|---------|
| `Active` | Currently relevant, regularly accessed |
| `Dormant` | Still accurate but rarely accessed (auto after 90 days) |
| `Archived` | No longer relevant but preserved for history |
| `Superseded` | Replaced by newer, more accurate information |
| `Unverified` | Extracted but not yet confirmed by evidence |

### Tier Values

| Tier | Meaning | Decay Behavior |
|------|---------|----------------|
| `Instant` | Working memory, current conversation only | Discarded at conversation end unless promoted |
| `Short-Term` | Recent, unconsolidated (days to weeks) | Forgetting curve: steep at first, flattening |
| `Long-Term` | Consolidated, durable (indefinite) | Slow decay, never silent-delete, Dormant first |

---

## Edge Schema

Each edge represents a typed relationship between two nodes.

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440003",
  "source": "550e8400-e29b-41d4-a716-446655440000",
  "target": "660e8400-e29b-41d4-a716-446655440001",
  "type": "Influences",
  "confidence": 90,
  "strength": 75,
  "direction": "directed",
  "created_at": "2024-01-10T08:00:00Z",
  "last_verified": "2024-01-15T10:30:00Z",
  "evidence": [
    "User chose Elixir because of their functional programming preference"
  ],
  "explanation": "The user's preference for functional programming directly influenced their choice of Elixir for the project",
  "usage_frequency": 5
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID string | Yes | Immutable identifier |
| `source` | UUID string | Yes | Source node ID |
| `target` | UUID string | Yes | Target node ID |
| `type` | enum string | Yes | Relationship type (see below) |
| `confidence` | integer 0–100 | Yes | How certain this relationship exists |
| `strength` | integer 0–100 | Yes | How strong the connection is |
| `direction` | enum string | Yes | `directed` or `undirected` |
| `created_at` | ISO 8601 string | Yes | When the edge was first created |
| `last_verified` | ISO 8601 string | Yes | Most recent confirmation of this relationship |
| `evidence` | string[] | Yes | What supports this relationship |
| `explanation` | string | Yes | Plain-language description of the connection |
| `usage_frequency` | integer ≥0 | Yes | How often this edge has been traversed |

### Relationship Types

**Semantic relationships:**
- `Related To` — general topical connection (undirected)
- `Supports` — one fact provides evidence for another (directed)
- `Contradicts` — conflicting information (undirected)
- `Similar To` — overlapping but distinct concepts (undirected)
- `Opposite Of` — inverse or contrasting concepts (undirected)

**Causal/dependency relationships:**
- `Depends On` — one requires the other (directed)
- `Causes` — one leads to the other (directed)
- `Enables` — one makes the other possible (directed)
- `Requires` — necessary condition (directed)
- `Blocks` — one prevents the other (directed)

**Developmental relationships:**
- `Derived From` — evolved from a prior concept (directed)
- `Builds Upon` — extends or elaborates (directed)
- `Improves` — makes better in some dimension (directed)
- `Influences` — shapes thinking or decisions (directed)

**Role-type edges:**
- `Goal` — connects a memory to a goal (directed)
- `Project` — connects a memory to a project (directed)
- `Preference` — connects a memory to a preference (directed)
- `Interest` — connects a memory to an interest (directed)
- `Habit` — connects a memory to a habit (directed)
- `Skill` — connects a memory to a skill (directed)
- `Person` — connects a memory to a person (directed)
- `Experience` — connects a memory to an experience (directed)

---

## Changelog Entry Schema

Every modification to the graph is logged.

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "action": "update_node",
  "target_id": "550e8400-e29b-41d4-a716-446655440000",
  "changes": {
    "confidence": { "old": 70, "new": 85 },
    "evidence": { "added": ["User confirmed in conversation"] }
  },
  "reason": "User explicitly confirmed their preference for functional programming",
  "confidence_impact": "+15%",
  "affected_relationships": ["770e8400-e29b-41d4-a716-446655440003"]
}
```

### Actions

| Action | Description |
|--------|-------------|
| `add_node` | New node created |
| `update_node` | Existing node modified |
| `archive_node` | Node archived |
| `add_edge` | New edge created |
| `update_edge` | Existing edge modified |
| `remove_edge` | Edge removed |
| `tier_transition` | Node moved between tiers (Instant → Short-Term → Long-Term) |

---

## Processing Input Schema

When feeding extracted memories to `processor.py`:

```json
[
  {
    "title": "Prefers dark mode",
    "summary": "User consistently uses dark mode across all development tools",
    "description": "The user mentioned using dark mode in VS Code, terminal, and all web apps. They find it reduces eye strain during long coding sessions.",
    "category": "Preferences",
    "subcategory": "UI/UX",
    "confidence": 75,
    "importance": 5,
    "evidence": [
      "User said: 'I can't stand light themes, they hurt my eyes'"
    ],
    "tags": {
      "user": [],
      "ai": ["dark-mode", "ui-preference", "ergonomics"]
    },
    "relationships": [
      {
        "target_title": "Prefers functional programming",
        "type": "Related To",
        "explanation": "Both are strong coding environment preferences",
        "confidence": 60
      }
    ]
  }
]
```

---

## Retrieval Result Schema

Output from `retrieval.py`:

```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Prefers functional programming",
      "summary": "User strongly prefers functional programming paradigms",
      "category": "Preferences",
      "confidence": 85,
      "importance": 7,
      "relevance_score": 92.5,
      "from_expansion": false,
      "status": "Active"
    }
  ],
  "citations": [
    {
      "title": "Prefers functional programming",
      "summary": "User strongly prefers functional programming paradigms",
      "citation": "Prefers functional programming (high confidence: 85%, last accessed: 2024-01-15)",
      "category": "Preferences",
      "node_id": "550e8400-e29b-41d4-a716-446655440000"
    }
  ],
  "total_candidates": 15,
  "query": "what programming style does the user prefer"
}
```
