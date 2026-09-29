#!/usr/bin/env python3
"""
Memory Graph - Core Graph Operations

Manages the persistent knowledge graph stored as JSON.
Provides CRUD operations for nodes and edges, plus analysis utilities.
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# --- Configuration ---

DEFAULT_CONFIG = {
    "instant_promotion_min_confidence": 60,
    "instant_promotion_min_importance": 3,
    "short_term_consolidation_references": 3,
    "short_term_consolidation_days": 14,
    "short_term_decay_days": 21,
    "short_term_decay_rate_per_day": 2.0,
    "long_term_dormant_days": 90,
    "long_term_archive_days": 365,
    "long_term_decay_rate_per_month": 1.0,
    "max_candidates_retrieval": 20,
    "graph_version": "2.0.0",
}

VALID_TIERS = ["Instant", "Short-Term", "Long-Term"]
VALID_STATUSES = ["Active", "Dormant", "Archived", "Superseded", "Unverified"]


def load_config(memory_dir: str = "memory") -> dict:
    """Load config from memory/config.json, falling back to defaults."""
    config_path = Path(memory_dir) / "config.json"
    config = dict(DEFAULT_CONFIG)
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                user_config = json.load(f)
            config.update(user_config)
        except (json.JSONDecodeError, OSError):
            pass
    return config


def save_config(config: dict, memory_dir: str = "memory") -> None:
    """Save config to memory/config.json."""
    config_path = Path(memory_dir) / "config.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


# --- File I/O ---

def load_graph(graph_path: str) -> dict:
    """Load the graph from a JSON file. Returns empty graph if file doesn't exist.
    Migrates legacy nodes (missing tier field) to Long-Term."""
    path = Path(graph_path)
    if not path.exists():
        return _empty_graph()
    with open(path, "r", encoding="utf-8") as f:
        graph = json.load(f)
    # Migrate legacy nodes that lack tier field
    _migrate_legacy_nodes(graph)
    return graph


def save_graph(graph: dict, graph_path: str) -> None:
    """Save the graph to a JSON file atomically."""
    import os
    path = Path(graph_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    # Rotate changelog to prevent unbounded growth
    changelog = graph.get("_changelog", [])
    if len(changelog) > 500:
        graph["_changelog"] = changelog[-500:]

    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
    # Use os.replace for reliable Windows atomic overwrites
    try:
        tmp.replace(path)
    except PermissionError:
        os.replace(str(tmp), str(path))





# --- Initialization ---

def init_graph(memory_dir: str = "memory") -> dict:
    """Initialize the memory directory and empty graph structure."""
    d = Path(memory_dir)
    d.mkdir(parents=True, exist_ok=True)
    (d / "snapshots").mkdir(exist_ok=True)

    graph_path = d / "graph.json"

    if not graph_path.exists():
        graph = _empty_graph()
        save_graph(graph, str(graph_path))
        print(f"Initialized memory graph at {d}")
        return graph

    print(f"Memory graph already exists at {d}")
    return load_graph(str(graph_path))


def _empty_graph() -> dict:
    return {
        "metadata": {
            "created_at": _now(),
            "last_modified": _now(),
            "version": DEFAULT_CONFIG["graph_version"],
            "node_count": 0,
            "edge_count": 0,
        },
        "nodes": {},
        "edges": {},
    }


def _migrate_legacy_nodes(graph: dict) -> None:
    """Add tier and tier_history to nodes that predate the tier system.
    Legacy persistent nodes default to Long-Term (safe default — they survived
    long enough to still be in the graph)."""
    migrated = 0
    for node in graph.get("nodes", {}).values():
        if "tier" not in node:
            node["tier"] = "Long-Term"
            node["tier_history"] = [
                {"from": None, "to": "Long-Term", "at": node.get("created_at", _now()),
                 "reason": "Legacy migration — existing node assumed Long-Term"}
            ]
            migrated += 1
    if migrated:
        graph.setdefault("metadata", {})["version"] = DEFAULT_CONFIG["graph_version"]


# --- Node Operations ---

def add_node(
    graph: dict,
    title: str,
    summary: str,
    description: str,
    category: str,
    subcategory: str = "",
    confidence: int = 50,
    importance: int = 5,
    sources: Optional[list] = None,
    evidence: Optional[list] = None,
    tags: Optional[dict] = None,
    status: str = "Active",
    tier: str = "Short-Term",
) -> dict:
    """Add a new node to the graph. Returns the created node.
    New nodes default to Short-Term tier (awaiting consolidation)."""
    node_id = str(uuid.uuid4())
    now = _now()

    node = {
        "id": node_id,
        "title": title,
        "summary": summary,
        "description": description,
        "category": category,
        "subcategory": subcategory,
        "confidence": _clamp(confidence, 0, 100),
        "importance": _clamp(importance, 1, 10),
        "tier": tier,
        "tier_history": [
            {"from": None, "to": tier, "at": now, "reason": "Node created"}
        ],
        "created_at": now,
        "last_modified": now,
        "last_accessed": now,
        "retrieval_frequency": 0,
        "sources": sources or [],
        "evidence": evidence or [],
        "version_history": [],
        "embedding_ref": "",
        "related_entities": [],
        "tags": tags or {"user": [], "ai": []},
        "status": status,
    }

    graph["nodes"][node_id] = node
    graph["metadata"]["node_count"] = len(graph["nodes"])
    graph["metadata"]["last_modified"] = now

    _log_change(graph, "add_node", node_id, {}, f"Created node: {title}")
    return node


def update_node(graph: dict, node_id: str, updates: dict, reason: str = "") -> dict:
    """Update an existing node. Preserves history in version_history."""
    if node_id not in graph["nodes"]:
        raise ValueError(f"Node {node_id} not found")

    node = graph["nodes"][node_id]
    now = _now()

    # Save current state to version history
    snapshot = {k: v for k, v in node.items() if k != "version_history"}
    snapshot["snapshot_at"] = now
    node["version_history"].append(snapshot)

    # Track what changed
    changes = {}
    for key, new_val in updates.items():
        if key in node and key not in ("id", "created_at", "version_history"):
            old_val = node[key]
            if old_val != new_val:
                changes[key] = {"old": old_val, "new": new_val}
                node[key] = new_val

    node["last_modified"] = now
    graph["metadata"]["last_modified"] = now

    if changes:
        _log_change(
            graph, "update_node", node_id, changes,
            reason or f"Updated fields: {', '.join(changes.keys())}"
        )

    return node


def archive_node(graph: dict, node_id: str, reason: str = "") -> dict:
    """Archive a node (soft delete)."""
    return update_node(
        graph, node_id,
        {"status": "Archived", "last_modified": _now()},
        reason or "Archived"
    )


def supersede_node(graph: dict, old_id: str, new_id: str, reason: str = "") -> dict:
    """Mark a node as superseded by another."""
    update_node(
        graph, old_id,
        {"status": "Superseded", "last_modified": _now()},
        reason or f"Superseded by {new_id}"
    )
    # Add a Derived From edge from new to old
    add_edge(graph, new_id, old_id, "Derived From",
             explanation=f"Replaced older understanding",
             confidence=90)
    return graph["nodes"][old_id]


def touch_node(graph: dict, node_id: str) -> None:
    """Update last_accessed and increment retrieval_frequency."""
    if node_id in graph["nodes"]:
        node = graph["nodes"][node_id]
        node["last_accessed"] = _now()
        node["retrieval_frequency"] = node.get("retrieval_frequency", 0) + 1


def promote_tier(graph: dict, node_id: str, new_tier: str, reason: str = "") -> dict:
    """Promote (or demote) a node to a new tier. Logs the transition."""
    if node_id not in graph["nodes"]:
        raise ValueError(f"Node {node_id} not found")
    if new_tier not in VALID_TIERS:
        raise ValueError(f"Invalid tier: {new_tier}. Must be one of {VALID_TIERS}")

    node = graph["nodes"][node_id]
    old_tier = node.get("tier", "Long-Term")
    if old_tier == new_tier:
        return node

    now = _now()
    node["tier"] = new_tier
    node["tier_history"].append({
        "from": old_tier, "to": new_tier, "at": now,
        "reason": reason or f"Tier transition: {old_tier} → {new_tier}",
    })
    node["last_modified"] = now
    graph["metadata"]["last_modified"] = now

    _log_change(graph, "tier_transition", node_id,
                {"tier": {"old": old_tier, "new": new_tier}},
                reason or f"{old_tier} → {new_tier}")
    return node


def get_nodes_by_tier(graph: dict, tier: str) -> list:
    """Get all nodes in a specific tier."""
    return [n for n in graph["nodes"].values() if n.get("tier") == tier]


def get_tier_stats(graph: dict) -> dict:
    """Get counts of nodes per tier and status."""
    stats = {tier: 0 for tier in VALID_TIERS}
    for node in graph["nodes"].values():
        tier = node.get("tier", "Long-Term")
        stats[tier] = stats.get(tier, 0) + 1
    return stats


# --- Edge Operations ---

def add_edge(
    graph: dict,
    source: str,
    target: str,
    edge_type: str,
    confidence: int = 50,
    strength: int = 50,
    direction: str = "directed",
    evidence: Optional[list] = None,
    explanation: str = "",
) -> dict:
    """Add a new edge between two nodes."""
    if source not in graph["nodes"]:
        raise ValueError(f"Source node {source} not found")
    if target not in graph["nodes"]:
        raise ValueError(f"Target node {target} not found")

    edge_id = str(uuid.uuid4())
    now = _now()

    edge = {
        "id": edge_id,
        "source": source,
        "target": target,
        "type": edge_type,
        "confidence": _clamp(confidence, 0, 100),
        "strength": _clamp(strength, 0, 100),
        "direction": direction,
        "created_at": now,
        "last_verified": now,
        "evidence": evidence or [],
        "explanation": explanation,
        "usage_frequency": 0,
    }

    graph["edges"][edge_id] = edge
    graph["metadata"]["edge_count"] = len(graph["edges"])
    graph["metadata"]["last_modified"] = now

    # Update related_entities on both nodes
    if target not in graph["nodes"][source]["related_entities"]:
        graph["nodes"][source]["related_entities"].append(target)
    if source not in graph["nodes"][target]["related_entities"]:
        graph["nodes"][target]["related_entities"].append(source)

    _log_change(
        graph, "add_edge", edge_id, {},
        f"Added {edge_type} edge: {graph['nodes'][source]['title']} → {graph['nodes'][target]['title']}"
    )
    return edge


def update_edge(graph: dict, edge_id: str, updates: dict, reason: str = "") -> dict:
    """Update an existing edge."""
    if edge_id not in graph["edges"]:
        raise ValueError(f"Edge {edge_id} not found")

    edge = graph["edges"][edge_id]
    now = _now()
    changes = {}

    for key, new_val in updates.items():
        if key in edge and key not in ("id", "created_at"):
            old_val = edge[key]
            if old_val != new_val:
                changes[key] = {"old": old_val, "new": new_val}
                edge[key] = new_val

    graph["metadata"]["last_modified"] = now

    if changes:
        _log_change(
            graph, "update_edge", edge_id, changes,
            reason or f"Updated edge fields: {', '.join(changes.keys())}"
        )

    return edge


def remove_edge(graph: dict, edge_id: str, reason: str = "") -> None:
    """Remove an edge from the graph."""
    if edge_id not in graph["edges"]:
        raise ValueError(f"Edge {edge_id} not found")

    edge = graph["edges"][edge_id]
    source = edge["source"]
    target = edge["target"]

    # Update related_entities
    if target in graph["nodes"].get(source, {}).get("related_entities", []):
        graph["nodes"][source]["related_entities"].remove(target)
    if source in graph["nodes"].get(target, {}).get("related_entities", []):
        graph["nodes"][target]["related_entities"].remove(source)

    del graph["edges"][edge_id]
    graph["metadata"]["edge_count"] = len(graph["edges"])
    graph["metadata"]["last_modified"] = _now()

    _log_change(graph, "remove_edge", edge_id, {}, reason or "Removed edge")


# --- Query Operations ---

def find_nodes(
    graph: dict,
    query: str = "",
    category: str = "",
    status: str = "",
    min_confidence: int = 0,
    min_importance: int = 0,
    tags: Optional[list] = None,
) -> list:
    """Find nodes matching the given criteria."""
    results = []
    query_lower = query.lower()

    for node in graph["nodes"].values():
        # Filter by status
        if status and node["status"] != status:
            continue
        # Filter by category
        if category and node["category"] != category:
            continue
        # Filter by confidence
        if node["confidence"] < min_confidence:
            continue
        # Filter by importance
        if node["importance"] < min_importance:
            continue
        # Filter by tags
        if tags:
            node_tags = set(node.get("tags", {}).get("user", []) + node.get("tags", {}).get("ai", []))
            if not any(t in node_tags for t in tags):
                continue
        # Filter by query (simple text match)
        if query_lower:
            searchable = f"{node['title']} {node['summary']} {node['description']}".lower()
            if query_lower not in searchable:
                continue

        results.append(node)

    # Sort by importance * confidence (descending)
    results.sort(key=lambda n: n["importance"] * n["confidence"], reverse=True)
    return results


def get_neighbors(
    graph: dict,
    node_id: str,
    edge_types: Optional[list] = None,
    max_depth: int = 1,
) -> dict:
    """Get neighboring nodes up to max_depth hops away."""
    if node_id not in graph["nodes"]:
        raise ValueError(f"Node {node_id} not found")

    visited = set()
    result = {"nodes": {}, "edges": {}}
    queue = [(node_id, 0)]

    while queue:
        current_id, depth = queue.pop(0)
        if current_id in visited or depth > max_depth:
            continue
        visited.add(current_id)

        if current_id in graph["nodes"]:
            result["nodes"][current_id] = graph["nodes"][current_id]

        # Find connected edges
        for edge in graph["edges"].values():
            if edge["source"] == current_id or edge["target"] == current_id:
                if edge_types and edge["type"] not in edge_types:
                    continue
                result["edges"][edge["id"]] = edge
                neighbor = edge["target"] if edge["source"] == current_id else edge["source"]
                if neighbor not in visited and depth + 1 <= max_depth:
                    queue.append((neighbor, depth + 1))

    return result


def find_connections(graph: dict, node_id: str) -> list:
    """Find potential connections between a node and other nodes in the graph."""
    if node_id not in graph["nodes"]:
        raise ValueError(f"Node {node_id} not found")

    node = graph["nodes"][node_id]
    existing_neighbors = set(node.get("related_entities", []))
    candidates = []

    for other_id, other in graph["nodes"].items():
        if other_id == node_id or other_id in existing_neighbors:
            continue

        # Check for shared neighbors
        other_neighbors = set(other.get("related_entities", []))
        shared = existing_neighbors & other_neighbors

        # Check for same category
        same_category = node["category"] == other["category"]

        # Check for tag overlap
        node_tags = set(node.get("tags", {}).get("user", []) + node.get("tags", {}).get("ai", []))
        other_tags = set(other.get("tags", {}).get("user", []) + other.get("tags", {}).get("ai", []))
        tag_overlap = node_tags & other_tags

        score = len(shared) * 2 + (3 if same_category else 0) + len(tag_overlap)
        if score > 0:
            candidates.append({
                "node": other,
                "score": score,
                "shared_neighbors": len(shared),
                "same_category": same_category,
                "tag_overlap": list(tag_overlap),
            })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


# --- Analysis ---

def analyze_graph(graph: dict) -> dict:
    """Analyze the graph for patterns, gaps, and insights."""
    nodes = list(graph["nodes"].values())
    edges = list(graph["edges"].values())

    if not nodes:
        return {"message": "Graph is empty. Start adding memories!"}

    # Category distribution
    categories = {}
    for n in nodes:
        cat = n["category"]
        categories[cat] = categories.get(cat, 0) + 1

    # Status distribution
    statuses = {}
    for n in nodes:
        s = n["status"]
        statuses[s] = statuses.get(s, 0) + 1

    # Confidence distribution
    conf_buckets = {"low (0-30)": 0, "medium (31-70)": 0, "high (71-100)": 0}
    for n in nodes:
        c = n["confidence"]
        if c <= 30:
            conf_buckets["low (0-30)"] += 1
        elif c <= 70:
            conf_buckets["medium (31-70)"] += 1
        else:
            conf_buckets["high (71-100)"] += 1

    # Relationship type distribution
    rel_types = {}
    for e in edges:
        t = e["type"]
        rel_types[t] = rel_types.get(t, 0) + 1

    # Most connected nodes (high degree)
    degree = {}
    for e in edges:
        degree[e["source"]] = degree.get(e["source"], 0) + 1
        degree[e["target"]] = degree.get(e["target"], 0) + 1
    top_connected = sorted(degree.items(), key=lambda x: x[1], reverse=True)[:5]
    top_connected = [
        {"title": graph["nodes"][nid]["title"], "connections": count}
        for nid, count in top_connected if nid in graph["nodes"]
    ]

    # Isolated nodes (no edges)
    connected_ids = set()
    for e in edges:
        connected_ids.add(e["source"])
        connected_ids.add(e["target"])
    isolated = [
        {"id": n["id"], "title": n["title"]}
        for n in nodes if n["id"] not in connected_ids
    ]

    # Contradictions
    contradictions = [
        {"edge_id": e["id"], "source": graph["nodes"].get(e["source"], {}).get("title", "?"),
         "target": graph["nodes"].get(e["target"], {}).get("title", "?")}
        for e in edges if e["type"] == "Contradicts"
    ]

    # Dormant nodes (low retrieval frequency)
    dormant = [
        {"id": n["id"], "title": n["title"], "retrieval_frequency": n["retrieval_frequency"]}
        for n in nodes
        if n["status"] == "Active" and n["retrieval_frequency"] == 0
    ]
    dormant.sort(key=lambda x: x["retrieval_frequency"])

    # Average confidence by category
    cat_confidence = {}
    for n in nodes:
        cat = n["category"]
        if cat not in cat_confidence:
            cat_confidence[cat] = []
        cat_confidence[cat].append(n["confidence"])
    avg_confidence = {
        cat: round(sum(confs) / len(confs), 1)
        for cat, confs in cat_confidence.items()
    }

    return {
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "categories": len(categories),
            "avg_confidence": round(sum(n["confidence"] for n in nodes) / len(nodes), 1),
        },
        "categories": categories,
        "statuses": statuses,
        "confidence_distribution": conf_buckets,
        "relationship_types": rel_types,
        "most_connected": top_connected,
        "isolated_nodes": isolated,
        "contradictions": contradictions,
        "never_retrieved": dormant[:10],
        "avg_confidence_by_category": avg_confidence,
    }


# --- Snapshots ---

def create_snapshot(graph: dict, memory_dir: str = "memory") -> str:
    """Create a timestamped snapshot of the graph (without changelog to save space)."""
    snapshot_dir = Path(memory_dir) / "snapshots"
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    snapshot_path = snapshot_dir / f"snapshot_{timestamp}.json"

    # Exclude changelog from snapshots to keep them lean
    snapshot_graph = {k: v for k, v in graph.items() if k != "_changelog"}
    save_graph(snapshot_graph, str(snapshot_path))
    print(f"Snapshot saved to {snapshot_path}")
    return str(snapshot_path)


# --- Changelog ---

def _log_change(
    graph: dict,
    action: str,
    target_id: str,
    changes: dict,
    reason: str,
) -> None:
    """Append a change entry to the graph's internal changelog list."""
    if "_changelog" not in graph:
        graph["_changelog"] = []

    graph["_changelog"].append({
        "timestamp": _now(),
        "action": action,
        "target_id": target_id,
        "changes": changes,
        "reason": reason,
    })


def get_changelog(graph: dict, limit: int = 20) -> list:
    """Get recent changelog entries."""
    entries = graph.get("_changelog", [])
    return entries[-limit:]


# --- Utilities ---

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp(value: int, min_val: int, max_val: int) -> int:
    return max(min_val, min(max_val, value))


# --- CLI ---

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Memory Graph Operations")
    subparsers = parser.add_subparsers(dest="command")

    # init
    subparsers.add_parser("init", help="Initialize memory directory")

    # add-node
    p = subparsers.add_parser("add-node", help="Add a new node")
    p.add_argument("--title", required=True)
    p.add_argument("--summary", required=True)
    p.add_argument("--description", default="")
    p.add_argument("--category", required=True)
    p.add_argument("--subcategory", default="")
    p.add_argument("--confidence", type=int, default=50)
    p.add_argument("--importance", type=int, default=5)
    p.add_argument("--status", default="Active")
    p.add_argument("--graph", default="memory/graph.json")

    # update-node
    p = subparsers.add_parser("update-node", help="Update a node")
    p.add_argument("--node-id", required=True)
    p.add_argument("--field", required=True, help="Field to update")
    p.add_argument("--value", required=True, help="New value")
    p.add_argument("--reason", default="")
    p.add_argument("--graph", default="memory/graph.json")

    # archive-node
    p = subparsers.add_parser("archive-node", help="Archive a node")
    p.add_argument("--node-id", required=True)
    p.add_argument("--reason", default="")
    p.add_argument("--graph", default="memory/graph.json")

    # add-edge
    p = subparsers.add_parser("add-edge", help="Add an edge")
    p.add_argument("--source", required=True)
    p.add_argument("--target", required=True)
    p.add_argument("--type", required=True, dest="edge_type")
    p.add_argument("--confidence", type=int, default=50)
    p.add_argument("--strength", type=int, default=50)
    p.add_argument("--explanation", default="")
    p.add_argument("--graph", default="memory/graph.json")

    # find
    p = subparsers.add_parser("find", help="Find nodes")
    p.add_argument("--query", default="")
    p.add_argument("--category", default="")
    p.add_argument("--status", default="")
    p.add_argument("--min-confidence", type=int, default=0)
    p.add_argument("--min-importance", type=int, default=0)
    p.add_argument("--graph", default="memory/graph.json")

    # neighbors
    p = subparsers.add_parser("neighbors", help="Get neighbors of a node")
    p.add_argument("--node-id", required=True)
    p.add_argument("--depth", type=int, default=1)
    p.add_argument("--graph", default="memory/graph.json")

    # find-connections
    p = subparsers.add_parser("find-connections", help="Find potential connections")
    p.add_argument("--node-id", required=True)
    p.add_argument("--graph", default="memory/graph.json")

    # analyze
    p = subparsers.add_parser("analyze", help="Analyze graph for insights")
    p.add_argument("--graph", default="memory/graph.json")

    # snapshot
    p = subparsers.add_parser("snapshot", help="Create a graph snapshot")
    p.add_argument("--graph", default="memory/graph.json")
    p.add_argument("--memory-dir", default="memory")

    # changelog
    p = subparsers.add_parser("changelog", help="View recent changes")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--graph", default="memory/graph.json")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "init":
        init_graph()
        return

    graph = load_graph(args.graph)

    if args.command == "add-node":
        node = add_node(
            graph, args.title, args.summary, args.description or args.summary,
            args.category, args.subcategory, args.confidence, args.importance,
            status=args.status,
        )
        save_graph(graph, args.graph)
        print(json.dumps(node, indent=2))

    elif args.command == "update-node":
        # Try to parse value as JSON, fall back to string
        try:
            value = json.loads(args.value)
        except (json.JSONDecodeError, TypeError):
            value = args.value
        node = update_node(graph, args.node_id, {args.field: value}, args.reason)
        save_graph(graph, args.graph)
        print(json.dumps(node, indent=2))

    elif args.command == "archive-node":
        node = archive_node(graph, args.node_id, args.reason)
        save_graph(graph, args.graph)
        print(json.dumps(node, indent=2))

    elif args.command == "add-edge":
        edge = add_edge(
            graph, args.source, args.target, args.edge_type,
            args.confidence, args.strength, explanation=args.explanation,
        )
        save_graph(graph, args.graph)
        print(json.dumps(edge, indent=2))

    elif args.command == "find":
        results = find_nodes(
            graph, args.query, args.category, args.status,
            args.min_confidence, args.min_importance,
        )
        print(json.dumps(results, indent=2))

    elif args.command == "neighbors":
        result = get_neighbors(graph, args.node_id, max_depth=args.depth)
        print(json.dumps(result, indent=2))

    elif args.command == "find-connections":
        candidates = find_connections(graph, args.node_id)
        print(json.dumps(candidates, indent=2))

    elif args.command == "analyze":
        insights = analyze_graph(graph)
        print(json.dumps(insights, indent=2))

    elif args.command == "snapshot":
        path = create_snapshot(graph, args.memory_dir)
        print(f"Snapshot saved to {path}")

    elif args.command == "changelog":
        entries = get_changelog(graph, args.limit)
        print(json.dumps(entries, indent=2))


if __name__ == "__main__":
    main()
