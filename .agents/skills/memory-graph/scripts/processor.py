#!/usr/bin/env python3
"""
Memory Graph - Processing Pipeline

Implements the 7-step pipeline for processing conversations into graph memories.
This script handles the deterministic parts; the AI agent handles extraction,
validation, and relationship discovery using its intelligence.

Usage:
    python processor.py process --graph memory/graph.json --memories memories.json
    python processor.py process --graph memory/graph.json  (reads from stdin)
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent))
from graph_ops import (
    load_graph, save_graph, add_node, update_node, add_edge,
    find_nodes, touch_node, promote_tier, load_config, _now, _clamp
)


def process_memories(graph: dict, memories: list) -> dict:
    """
    Process a list of extracted memories through the full pipeline.

    Each memory in the list should be a dict with:
    {
        "title": "...",
        "summary": "...",
        "description": "...",
        "category": "...",
        "subcategory": "...",
        "confidence": 50,
        "importance": 5,
        "evidence": ["..."],
        "tags": {"user": [], "ai": []},
        "relationships": [
            {"target_title": "...", "type": "...", "explanation": "...", "confidence": 50}
        ]
    }

    Returns a summary of what was done.
    """
    summary = {
        "nodes_added": 0,
        "nodes_updated": 0,
        "nodes_merged": 0,
        "edges_added": 0,
        "confidence_changes": [],
        "duplicates_found": [],
        "new_nodes": [],
    }

    for memory in memories:
        result = _process_single_memory(graph, memory)
        summary["nodes_added"] += result.get("added", 0)
        summary["nodes_updated"] += result.get("updated", 0)
        summary["nodes_merged"] += result.get("merged", 0)
        summary["edges_added"] += result.get("edges_added", 0)
        if result.get("confidence_change"):
            summary["confidence_changes"].append(result["confidence_change"])
        if result.get("duplicate"):
            summary["duplicates_found"].append(result["duplicate"])
        if result.get("node_id"):
            summary["new_nodes"].append(result["node_id"])

    # Step 6: Graph evolution (tier-aware lifecycle management)
    lifecycle = _evolve_lifecycle(graph)
    summary["lifecycle"] = lifecycle

    return summary


def _process_single_memory(graph: dict, memory: dict) -> dict:
    """Process a single memory through the pipeline."""
    result = {}

    # Step 2: Deduplication - check for existing similar nodes
    duplicate = _find_duplicate(graph, memory)

    if duplicate:
        result["duplicate"] = duplicate["title"]

        # Step 3: Validation - determine relationship type
        validation = _validate_against_existing(memory, duplicate)

        if validation["action"] == "update":
            is_contradiction = validation.get("contradiction", False)

            if is_contradiction:
                # For contradictions, lower existing confidence, enrich with context, and create a new node
                old_conf = duplicate["confidence"]
                new_conf = _calibrate_confidence(old_conf, old_conf, "contradicted")
                existing_ev = duplicate.get("evidence", [])
                contradiction_note = f"Contradicted by new information: {memory.get('summary', '')}"
                update_node(graph, duplicate["id"],
                           {"confidence": new_conf, "evidence": existing_ev + [contradiction_note]},
                           f"Confidence lowered due to contradicting information")
                result["confidence_change"] = {
                    "node": duplicate["title"],
                    "old": old_conf,
                    "new": new_conf,
                    "reason": "contradicted",
                }
                # Create new node for the contradicting info
                new_node = _create_node_from_memory(graph, memory)
                add_edge(graph, new_node["id"], duplicate["id"], "Contradicts",
                        explanation="New information contradicts existing knowledge",
                        confidence=70)
                result["added"] = 1
                result["node_id"] = new_node["id"]
            else:
                # Update existing node
                updates = {}
                if memory.get("description"):
                    updates["description"] = memory["description"]
                if memory.get("confidence"):
                    old_conf = duplicate["confidence"]
                    new_conf = _calibrate_confidence(
                        old_conf, memory["confidence"], validation["event"]
                    )
                    updates["confidence"] = new_conf
                    result["confidence_change"] = {
                        "node": duplicate["title"],
                        "old": old_conf,
                        "new": new_conf,
                        "reason": validation["event"],
                    }
                if memory.get("evidence"):
                    existing_ev = duplicate.get("evidence", [])
                    updates["evidence"] = existing_ev + memory["evidence"]
                if memory.get("tags"):
                    existing_tags = duplicate.get("tags", {"user": [], "ai": []})
                    for key in ("user", "ai"):
                        existing_tags.setdefault(key, [])
                        existing_tags[key].extend(memory["tags"].get(key, []))
                        existing_tags[key] = list(set(existing_tags[key]))
                    updates["tags"] = existing_tags

                if updates:
                    update_node(graph, duplicate["id"], updates,
                               f"Updated from new conversation evidence")
                    result["updated"] = 1
                    result["node_id"] = duplicate["id"]

        elif validation["action"] == "supersede":
            # Create new node and mark old as superseded
            new_node = _create_node_from_memory(graph, memory)
            _supersede_node(graph, duplicate["id"], new_node["id"])
            result["added"] = 1
            result["node_id"] = new_node["id"]

        elif validation["action"] == "merge":
            # Merge information into existing
            _merge_into_node(graph, duplicate, memory)
            result["merged"] = 1
            result["node_id"] = duplicate["id"]

    else:
        # No duplicate - create new node
        new_node = _create_node_from_memory(graph, memory)
        result["added"] = 1
        result["node_id"] = new_node["id"]

    # Step 4: Relationship discovery
    node_id = result.get("node_id")
    if node_id:
        edges_added = _discover_relationships(graph, node_id, memory)
        result["edges_added"] = edges_added

    return result


def _find_duplicate(graph: dict, memory: dict) -> Optional[dict]:
    """Search for semantically similar existing nodes."""
    # Stopwords to ignore in matching
    stopwords = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
                 "have", "has", "had", "do", "does", "did", "will", "would", "could",
                 "should", "may", "might", "can", "shall", "to", "of", "in", "for",
                 "on", "with", "at", "by", "from", "as", "and", "but", "or", "not",
                 "no", "nor", "so", "yet", "both", "either", "neither", "i", "me",
                 "my", "we", "our", "you", "your", "he", "him", "his", "she", "her",
                 "they", "them", "their", "it", "its", "this", "that", "these", "those"}

    title = memory.get("title", "").lower()
    summary = memory.get("summary", "").lower()
    category = memory.get("category", "")

    title_words = set(title.split()) - stopwords
    summary_words = set(summary.split()) - stopwords

    best_match = None
    best_score = 0

    for node in graph["nodes"].values():
        if node["status"] == "Archived":
            continue

        score = 0

        # Title similarity — weighted heavily
        node_title = node["title"].lower()
        node_words = set(node_title.split()) - stopwords
        if title_words and node_words:
            overlap = len(title_words & node_words) / max(len(title_words), len(node_words))
            score += overlap * 50

        # Summary similarity
        node_summary = node["summary"].lower()
        node_summary_words = set(node_summary.split()) - stopwords
        if summary_words and node_summary_words:
            overlap = len(summary_words & node_summary_words) / max(len(summary_words), len(node_summary_words))
            score += overlap * 30

        # Category match — boost for same category, mild penalty for mismatch
        if node["category"] == category:
            score += 20
        else:
            # Mild penalty — cross-domain duplicates are possible (Skills vs Learning)
            score *= 0.7

        # Threshold: 55 ensures meaningful overlap beyond just category match
        if score > best_score and score > 55:
            best_score = score
            best_match = node

    return best_match


def _validate_against_existing(new_memory: dict, existing: dict) -> dict:
    """Determine how new info relates to existing knowledge."""
    new_desc = (new_memory.get("description", "") or "").lower()
    existing_desc = (existing.get("description", "") or "").lower()
    new_summary = (new_memory.get("summary", "") or "").lower()
    existing_summary = (existing.get("summary", "") or "").lower()

    # Check for contradiction signals — require both a change signal AND a comparison/explicit replacement
    change_signals = ["switched", "changed", "now uses", "replaced", "no longer",
                      "moved to", "stopped using", "instead of", "upgraded to", "transitioned to"]
    comparison_signals = ["instead of", "rather than", "no longer", "replaced", "switched from"]
    has_change = any(sig in new_desc or sig in new_summary for sig in change_signals)
    has_comparison = any(sig in new_desc or sig in new_summary for sig in comparison_signals)

    # Require both signals to avoid false positives ("I changed my approach" != contradiction)
    if has_change and has_comparison:
        return {"action": "update", "event": "contradicted", "contradiction": True}

    # Check if new info adds meaningful detail (longer description with new content)
    if new_desc and len(new_desc) > len(existing_desc) * 1.3:
        # Check that it's not just a superset — it should have new words
        new_words = set(new_desc.split())
        existing_words = set(existing_desc.split())
        novel_words = new_words - existing_words
        if len(novel_words) > 3:
            return {"action": "update", "event": "expanded_with_new_detail"}

    # Check if the new info is from a different source (adds evidence)
    new_sources = set(new_memory.get("sources", []))
    existing_sources = set(existing.get("sources", []))
    if new_sources and not new_sources.issubset(existing_sources):
        return {"action": "update", "event": "confirmed_by_new_evidence"}

    # Default: reinforce
    return {"action": "update", "event": "reinforced_by_new_evidence"}


def _create_node_from_memory(graph: dict, memory: dict) -> dict:
    """Create a new node from extracted memory data.
    New nodes start as Short-Term (awaiting consolidation)."""
    return add_node(
        graph,
        title=memory.get("title", "Untitled"),
        summary=memory.get("summary", ""),
        description=memory.get("description", memory.get("summary", "")),
        category=memory.get("category", "Personal Knowledge"),
        subcategory=memory.get("subcategory", ""),
        confidence=memory.get("confidence", 50),
        importance=memory.get("importance", 5),
        evidence=memory.get("evidence", []),
        tags=memory.get("tags", {"user": [], "ai": []}),
        status="Active",
        tier=memory.get("tier", "Short-Term"),
    )


def _supersede_node(graph: dict, old_id: str, new_id: str) -> None:
    """Mark old node as superseded and create link to new."""
    update_node(graph, old_id, {"status": "Superseded"}, f"Superseded by {new_id}")
    add_edge(
        graph, new_id, old_id, "Derived From",
        explanation="Replaced older understanding",
        confidence=90,
    )


def _merge_into_node(graph: dict, existing: dict, new_memory: dict) -> None:
    """Merge new information into an existing node."""
    updates = {}

    # Merge descriptions
    if new_memory.get("description"):
        existing_desc = existing.get("description", "")
        if new_memory["description"] not in existing_desc:
            updates["description"] = f"{existing_desc}\n\n{new_memory['description']}"

    # Merge evidence
    if new_memory.get("evidence"):
        existing_ev = existing.get("evidence", [])
        new_ev = [e for e in new_memory["evidence"] if e not in existing_ev]
        if new_ev:
            updates["evidence"] = existing_ev + new_ev

    # Merge tags
    if new_memory.get("tags"):
        existing_tags = existing.get("tags", {"user": [], "ai": []})
        for key in ("user", "ai"):
            existing_tags.setdefault(key, [])
            for tag in new_memory["tags"].get(key, []):
                if tag not in existing_tags[key]:
                    existing_tags[key].append(tag)
        updates["tags"] = existing_tags

    if updates:
        update_node(graph, existing["id"], updates, "Merged new evidence into existing node")


def _discover_relationships(graph: dict, node_id: str, memory: dict) -> int:
    """Create edges for explicitly specified relationships."""
    edges_added = 0
    relationships = memory.get("relationships", [])

    for rel in relationships:
        target_title = rel.get("target_title", "").lower()
        if not target_title:
            continue

        # Find target node by title
        target_node = None
        for node in graph["nodes"].values():
            if node["id"] == node_id:
                continue
            if node["title"].lower() == target_title or target_title in node["title"].lower():
                target_node = node
                break

        if target_node:
            add_edge(
                graph, node_id, target_node["id"],
                rel.get("type", "Related To"),
                confidence=rel.get("confidence", 50),
                strength=rel.get("strength", 50),
                explanation=rel.get("explanation", ""),
            )
            edges_added += 1

    return edges_added


def _calibrate_confidence(old_confidence: int, new_confidence: int, event: str) -> int:
    """Calibrate confidence based on event type."""
    changes = {
        "confirmed_by_new_evidence": 10,
        "expanded_with_new_detail": 8,
        "reinforced_by_new_evidence": 5,
        "superseded_by_higher_confidence": 0,  # New node takes over
        "contradicted": -15,
        "user_confirmed": 20,
        "user_denied": -40,
    }

    delta = changes.get(event, 5)
    new_val = old_confidence + delta

    # Gradual change - don't swing more than 25% in one update
    max_change = 25
    if abs(new_val - old_confidence) > max_change:
        new_val = old_confidence + (max_change if delta > 0 else -max_change)

    return _clamp(new_val, 0, 95)  # Never exceed 95%


def _evolve_lifecycle(graph: dict, config: dict = None) -> dict:
    """Tier-aware lifecycle management.

    Rules (config-driven):
    - Short-Term: promote to Long-Term if referenced enough or high-importance.
      Decay confidence on a forgetting curve; archive if fully decayed.
    - Long-Term: never delete. Move to Dormant after prolonged disuse,
      then Archived only after extreme disuse + low importance.
    - Instant: should not appear in persistent graph (handled by AI in-session).
    - Superseded: still tracked for lineage, but not subject to decay.
    """
    if config is None:
        config = load_config()
    now = datetime.now(timezone.utc)
    lifecycle = {"promoted": [], "archived": [], "dormant": [], "decayed": []}

    for node in list(graph["nodes"].values()):
        # Skip Archived nodes (they're done). Superseded nodes still tracked.
        if node["status"] == "Archived":
            continue
        # Superseded nodes are retired but keep lineage — skip decay
        if node["status"] == "Superseded":
            continue

        tier = node.get("tier", "Long-Term")
        last_accessed = node.get("last_accessed", node.get("created_at", ""))
        if not last_accessed:
            continue

        try:
            last_dt = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
            days_since = (now - last_dt).days
        except (ValueError, TypeError):
            continue

        if tier == "Short-Term":
            _evolve_short_term(graph, node, days_since, config, lifecycle)
        elif tier == "Long-Term":
            _evolve_long_term(graph, node, days_since, config, lifecycle)

    return lifecycle


def _evolve_short_term(graph: dict, node: dict, days_since: int, config: dict, lifecycle: dict) -> None:
    """Short-Term lifecycle: promote to Long-Term or decay/archive."""
    refs = node.get("retrieval_frequency", 0)
    importance = node.get("importance", 5)
    confidence = node.get("confidence", 50)

    # Consolidation rule: promote to Long-Term if referenced enough, or high-importance
    if (refs >= config["short_term_consolidation_references"]
            or importance >= 7
            or (days_since >= config["short_term_consolidation_days"] and confidence >= 60)):
        promote_tier(graph, node["id"], "Long-Term",
                     f"Consolidated: {refs} references, importance={importance}, {days_since}d old")
        lifecycle["promoted"].append(node["id"])
        return

    # Decay rule: if not referenced within window, decay confidence on forgetting curve
    if days_since > config["short_term_decay_days"]:
        decay_days = days_since - config["short_term_decay_days"]
        decay = decay_days * config["short_term_decay_rate_per_day"]
        new_conf = max(0, int(confidence - decay))

        if new_conf <= 10:
            # Fully decayed — archive (not delete, visible in version history)
            update_node(graph, node["id"],
                       {"confidence": 0, "status": "Archived"},
                       f"Short-Term decay: {days_since}d without reference, confidence decayed to 0")
            lifecycle["archived"].append(node["id"])
        else:
            update_node(graph, node["id"],
                       {"confidence": new_conf},
                       f"Short-Term decay: {days_since}d without reference, confidence {confidence}→{new_conf}")
            lifecycle["decayed"].append(node["id"])


def _evolve_long_term(graph: dict, node: dict, days_since: int, config: dict, lifecycle: dict) -> None:
    """Long-Term lifecycle: slow decay, dormancy, archival — never silent delete."""
    confidence = node.get("confidence", 50)
    importance = node.get("importance", 5)
    refs = node.get("retrieval_frequency", 0)

    # Reinforcement: recently-referenced nodes skip decay, but still check dormancy
    recently_reinforced = refs > 0 and days_since < 30

    # Dormancy: move to Dormant after prolonged disuse (always check, even if reinforced)
    if days_since > config["long_term_dormant_days"] and node["status"] == "Active":
        update_node(graph, node["id"],
                   {"status": "Dormant"},
                   f"Long-Term dormancy: no access for {days_since} days")
        lifecycle["dormant"].append(node["id"])
        return

    # Skip decay for recently reinforced nodes
    if recently_reinforced:
        return

    # Slow decay for dormant nodes
    if node["status"] == "Dormant" and days_since > config["long_term_dormant_days"]:
        months_since_dormant = (days_since - config["long_term_dormant_days"]) / 30
        decay = months_since_dormant * config["long_term_decay_rate_per_month"]
        new_conf = max(20, int(confidence - decay))  # Floor at 20% for Long-Term

        if new_conf < confidence:
            update_node(graph, node["id"],
                       {"confidence": new_conf},
                       f"Long-Term slow decay: {months_since_dormant:.1f} months dormant, {confidence}→{new_conf}")
            lifecycle["decayed"].append(node["id"])

        # Archive only after extreme disuse AND low importance
        if days_since > config["long_term_archive_days"] and importance <= 3:
            update_node(graph, node["id"],
                       {"status": "Archived"},
                       f"Long-Term archive: {days_since}d unaccessed, importance={importance}")
            lifecycle["archived"].append(node["id"])


# --- CLI ---

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Memory Graph Processing Pipeline")
    subparsers = parser.add_subparsers(dest="command")

    # process
    p = subparsers.add_parser("process", help="Process extracted memories")
    p.add_argument("--graph", default="memory/graph.json", help="Path to graph.json")
    p.add_argument("--memories", help="Path to JSON file with extracted memories (or reads stdin)")

    # calibrate
    p = subparsers.add_parser("calibrate", help="Calibrate confidence for a node")
    p.add_argument("--node-id", required=True)
    p.add_argument("--event", required=True,
                   choices=["confirmed", "expanded", "reinforced", "contradicted",
                            "user_confirmed", "user_denied"])
    p.add_argument("--graph", default="memory/graph.json")

    # evolve
    p = subparsers.add_parser("evolve", help="Run graph evolution (archive dormant nodes)")
    p.add_argument("--graph", default="memory/graph.json")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "process":
        graph = load_graph(args.graph)

        # Load memories from file or stdin
        if args.memories:
            with open(args.memories, "r", encoding="utf-8") as f:
                memories = json.load(f)
        else:
            memories = json.load(sys.stdin)

        summary = process_memories(graph, memories)
        save_graph(graph, args.graph)
        print(json.dumps(summary, indent=2))

    elif args.command == "calibrate":
        graph = load_graph(args.graph)
        if args.node_id not in graph["nodes"]:
            print(f"Error: Node {args.node_id} not found", file=sys.stderr)
            sys.exit(1)

        node = graph["nodes"][args.node_id]
        event_map = {
            "confirmed": "confirmed_by_new_evidence",
            "expanded": "expanded_with_new_detail",
            "reinforced": "reinforced_by_new_evidence",
            "contradicted": "contradicted",
            "user_confirmed": "user_confirmed",
            "user_denied": "user_denied",
        }
        event = event_map[args.event]
        old_conf = node["confidence"]
        new_conf = _calibrate_confidence(old_conf, old_conf, event)

        update_node(graph, args.node_id, {"confidence": new_conf},
                   f"Confidence calibrated: {args.event}")
        save_graph(graph, args.graph)
        print(f"Confidence: {old_conf}% → {new_conf}% ({args.event})")

    elif args.command == "evolve":
        graph = load_graph(args.graph)
        _evolve_dormant_nodes(graph)
        save_graph(graph, args.graph)
        print("Graph evolution complete")


if __name__ == "__main__":
    main()
