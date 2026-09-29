#!/usr/bin/env python3
"""
Memory Graph - Retrieval and Ranking

Implements semantic search + graph traversal retrieval strategy.
Finds relevant memories and ranks them by multiple factors.
"""

import json
import sys
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent))
from graph_ops import load_graph, find_nodes, get_neighbors, touch_node, load_config


def retrieve_relevant(
    graph: dict,
    query: str,
    top_k: int = 10,
    expand_depth: int = 2,
    min_confidence: int = 20,
    exclude_categories: Optional[list] = None,
) -> dict:
    """
    Scoped, tier-aware retrieval. Never scans the whole graph blindly.

    Strategy:
    1. Query first, traverse second — derive semantic candidates, then expand.
    2. Tier-aware shortcut — check Instant/Short-Term first (small, cheap),
       only reach into Long-Term if the task needs durable knowledge.
    3. Cap the candidate set — top-N by ranking, not everything above threshold.
    4. Skip irrelevant domains — filter by category when the task is scoped.
    5. Log what was actually used — which nodes shaped the response.

    Returns a dict with:
    - results: ranked list of relevant nodes
    - citations: formatted citations for use in responses
    - retrieval_log: which nodes were used and why
    - tier_breakdown: how many results came from each tier
    """
    config = load_config()
    max_candidates = config.get("max_candidates_retrieval", 20)
    exclude_cats = set(exclude_categories or [])

    # Step 1: Tier-aware shortcut — search Instant/Short-Term first
    recent_matches = _semantic_search(graph, query, min_confidence,
                                      tiers=["Instant", "Short-Term"],
                                      exclude_cats=exclude_cats)

    # If recent context has strong matches, we may not need Long-Term
    recent_strong = any(score > 60 for score in recent_matches.values())
    long_term_matches = {}
    if not recent_strong or len(recent_matches) < top_k:
        # Reach into Long-Term for durable/background knowledge
        long_term_matches = _semantic_search(graph, query, min_confidence,
                                             tiers=["Long-Term"],
                                             exclude_cats=exclude_cats)

    # Combine semantic matches
    all_semantic = {**recent_matches, **long_term_matches}

    # Step 2: Graph expansion — traverse from top semantic matches only
    top_seeds = dict(sorted(all_semantic.items(), key=lambda x: x[1], reverse=True)[:max_candidates])
    expansion_nodes = _graph_expand(graph, top_seeds, expand_depth, exclude_cats)

    # Step 3: Build candidate set
    all_candidates = {}
    for node_id, score in all_semantic.items():
        all_candidates[node_id] = {
            "node": graph["nodes"][node_id],
            "semantic_score": score,
            "graph_score": 0,
            "from_expansion": False,
        }
    for node_id, score in expansion_nodes.items():
        if node_id in all_candidates:
            all_candidates[node_id]["graph_score"] = score
        else:
            node = graph["nodes"].get(node_id)
            if node and node.get("category") not in exclude_cats:
                all_candidates[node_id] = {
                    "node": graph["nodes"][node_id],
                    "semantic_score": 0,
                    "graph_score": score,
                    "from_expansion": True,
                }

    # Step 4: Rank and cap
    ranked = _rank_results(graph, all_candidates, query)
    top_results = ranked[:top_k]

    # Touch retrieved nodes (update access time and frequency)
    for result in top_results:
        touch_node(graph, result["node"]["id"])

    # Step 5: Build retrieval log and tier breakdown
    citations = _format_citations(top_results)
    retrieval_log = _build_retrieval_log(top_results)
    tier_breakdown = {}
    for r in top_results:
        tier = r["node"].get("tier", "Long-Term")
        tier_breakdown[tier] = tier_breakdown.get(tier, 0) + 1

    return {
        "results": [
            {
                "id": r["node"]["id"],
                "title": r["node"]["title"],
                "summary": r["node"]["summary"],
                "category": r["node"]["category"],
                "tier": r["node"].get("tier", "Long-Term"),
                "confidence": r["node"]["confidence"],
                "importance": r["node"]["importance"],
                "relevance_score": round(r["final_score"], 2),
                "from_expansion": r["from_expansion"],
                "status": r["node"]["status"],
            }
            for r in top_results
        ],
        "citations": citations,
        "retrieval_log": retrieval_log,
        "tier_breakdown": tier_breakdown,
        "total_candidates": len(all_candidates),
        "query": query,
    }


def _semantic_search(graph: dict, query: str, min_confidence: int = 20,
                     tiers: list = None, exclude_cats: set = None) -> dict:
    """
    Find nodes that semantically match the query.
    Uses TF-IDF-like word overlap with title, summary, description, and tags.

    Args:
        tiers: Optional list of tiers to search (e.g. ["Short-Term", "Long-Term"]).
               If None, searches all tiers.
        exclude_cats: Optional set of categories to exclude from results.
    """
    query_terms = _tokenize(query)
    if not query_terms:
        return {}

    tiers = tiers or ["Instant", "Short-Term", "Long-Term"]
    exclude_cats = exclude_cats or set()

    doc_count = len(graph["nodes"])
    if doc_count == 0:
        return {}

    # Build IDF from all nodes (for consistent scoring)
    term_doc_freq = Counter()
    for node in graph["nodes"].values():
        text = _node_text(node)
        terms = set(_tokenize(text))
        for term in terms:
            term_doc_freq[term] += 1

    idf = {}
    for term in query_terms:
        df = term_doc_freq.get(term, 0)
        if df > 0:
            idf[term] = 1.0 + (doc_count / df) ** 0.5
        else:
            idf[term] = 5.0

    scores = {}
    for node_id, node in graph["nodes"].items():
        # Tier filtering
        if node.get("tier", "Long-Term") not in tiers:
            continue
        if node["confidence"] < min_confidence:
            continue
        if node["status"] in ("Archived", "Superseded"):
            continue
        # Category filtering
        if node.get("category") in exclude_cats:
            continue
        score = _score_node(node, query_terms, idf)
        if score > 0:
            scores[node_id] = score

    # Normalize scores to 0-100
    if scores:
        max_score = max(scores.values())
        if max_score > 0:
            scores = {k: (v / max_score) * 100 for k, v in scores.items()}

    return scores


def _score_node(node: dict, query_terms: list, idf: dict) -> float:
    """Score a single node against query terms with TF-IDF weighting."""
    score = 0.0

    # Title gets highest weight
    title_terms = _tokenize(node["title"])
    for term in query_terms:
        if term in title_terms:
            score += 3.0 * idf.get(term, 1.0)

    # Summary gets medium weight
    summary_terms = _tokenize(node["summary"])
    for term in query_terms:
        if term in summary_terms:
            score += 2.0 * idf.get(term, 1.0)

    # Description gets lower weight
    desc_terms = _tokenize(node["description"])
    for term in query_terms:
        if term in desc_terms:
            score += 1.0 * idf.get(term, 1.0)

    # Tags get bonus weight
    all_tags = set(node.get("tags", {}).get("user", []) + node.get("tags", {}).get("ai", []))
    tag_terms = set()
    for tag in all_tags:
        tag_terms.update(_tokenize(tag))
    for term in query_terms:
        if term in tag_terms:
            score += 2.5 * idf.get(term, 1.0)

    # Category/subcategory match
    cat_terms = _tokenize(f"{node['category']} {node.get('subcategory', '')}")
    for term in query_terms:
        if term in cat_terms:
            score += 1.5 * idf.get(term, 1.0)

    return score


def _graph_expand(graph: dict, seed_nodes: dict, depth: int = 2,
                  exclude_cats: set = None) -> dict:
    """Expand from seed nodes via graph traversal.
    Supports category exclusion for scoped retrieval."""
    expanded = {}
    visited = set(seed_nodes.keys())
    exclude_cats = exclude_cats or set()

    queue = [(node_id, 0, seed_score) for node_id, seed_score in seed_nodes.items()]

    while queue:
        current_id, current_depth, parent_score = queue.pop(0)
        if current_depth >= depth:
            continue

        for edge in graph["edges"].values():
            neighbor_id = None
            if edge["source"] == current_id:
                neighbor_id = edge["target"]
            elif edge["target"] == current_id and edge["direction"] == "undirected":
                neighbor_id = edge["source"]

            if neighbor_id and neighbor_id not in visited:
                visited.add(neighbor_id)
                if neighbor_id not in graph["nodes"]:
                    continue

                node = graph["nodes"][neighbor_id]
                if node["status"] in ("Archived", "Superseded"):
                    continue
                if node.get("category") in exclude_cats:
                    continue

                edge_score = (edge["strength"] / 100) * (edge["confidence"] / 100)
                node_score = parent_score * edge_score * 0.6

                if node_score > 5:
                    expanded[neighbor_id] = node_score
                    queue.append((neighbor_id, current_depth + 1, node_score))

    return expanded


def _build_retrieval_log(results: list) -> list:
    """Build a log of which nodes were used and why.
    This makes retrieval explainable — you can always trace which memories
    shaped a response.

    Note: requires results from _rank_results (depends on 'factors' key).
    """
    log = []
    for r in results:
        node = r["node"]
        factors = r.get("factors", {})  # Only present after _rank_results
        reason_parts = []
        if r.get("from_expansion"):
            reason_parts.append("found via graph traversal")
        else:
            reason_parts.append("direct semantic match")
        if factors.get("confidence", 0) >= 80:
            reason_parts.append("high confidence")
        if factors.get("importance", 0) >= 70:
            reason_parts.append("high importance")

        log.append({
            "node_id": node["id"],
            "title": node["title"],
            "tier": node.get("tier", "Long-Term"),
            "category": node["category"],
            "relevance_score": round(r["final_score"], 1),
            "reason": ", ".join(reason_parts),
        })
    return log


def _rank_results(graph: dict, candidates: dict, query: str) -> list:
    """
    Rank candidates by combined factors:
    - Semantic relevance: 30%
    - Confidence: 25%
    - Recency: 20%
    - Importance: 15%
    - Relationship strength: 10%
    """
    now = datetime.now(timezone.utc)
    results = []

    for node_id, data in candidates.items():
        node = data["node"]

        # Semantic relevance (0-100)
        semantic = data["semantic_score"]

        # Confidence (0-100)
        confidence = node["confidence"]

        # Recency (0-100, based on days since last access)
        last_accessed = node.get("last_accessed", node.get("created_at", ""))
        recency = _compute_recency(last_accessed, now)

        # Importance (1-10 -> 0-100)
        importance = node["importance"] * 10

        # Relationship strength (from graph expansion)
        graph_score = data.get("graph_score", 0)

        # Weighted combination
        final_score = (
            semantic * 0.30 +
            confidence * 0.25 +
            recency * 0.20 +
            importance * 0.15 +
            graph_score * 0.10
        )

        results.append({
            **data,
            "final_score": final_score,
            "factors": {
                "semantic": round(semantic, 1),
                "confidence": confidence,
                "recency": round(recency, 1),
                "importance": importance,
                "graph": round(graph_score, 1),
            }
        })

    results.sort(key=lambda r: r["final_score"], reverse=True)
    return results


def _compute_recency(last_accessed: str, now: datetime) -> float:
    """Compute recency score (0-100) from last access time."""
    if not last_accessed:
        return 30.0  # Default for unknown

    try:
        last_dt = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
        days = (now - last_dt).days

        # Exponential decay: 100 at day 0, ~50 at day 30, ~25 at day 60
        if days <= 0:
            return 100.0
        elif days <= 7:
            return 90.0 - (days * 5)
        elif days <= 30:
            return 55.0 - ((days - 7) * 1.5)
        elif days <= 90:
            return 20.0 - ((days - 30) * 0.2)
        else:
            return max(5.0, 8.0 - ((days - 90) * 0.02))
    except (ValueError, TypeError):
        return 30.0


def _format_citations(results: list) -> list:
    """Format results as citations for use in responses."""
    citations = []
    for r in results:
        node = r["node"]
        conf = node["confidence"]
        last = node.get("last_accessed", "")[:10]  # Just date part

        # Confidence label
        if conf >= 80:
            conf_label = "high confidence"
        elif conf >= 50:
            conf_label = "moderate confidence"
        else:
            conf_label = "low confidence"

        citations.append({
            "title": node["title"],
            "summary": node["summary"],
            "citation": f"{node['title']} ({conf_label}: {conf}%, last accessed: {last})",
            "category": node["category"],
            "node_id": node["id"],
        })

    return citations


def _node_text(node: dict) -> str:
    """Get all searchable text from a node."""
    parts = [
        node.get("title", ""),
        node.get("summary", ""),
        node.get("description", ""),
        node.get("category", ""),
        node.get("subcategory", ""),
    ]
    tags = node.get("tags", {})
    parts.extend(tags.get("user", []))
    parts.extend(tags.get("ai", []))
    return " ".join(parts)


def _tokenize(text: str) -> list:
    """Simple tokenization: lowercase, split on non-alphanumeric, remove stopwords."""
    if not text:
        return []

    stopwords = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "can", "shall", "to", "of", "in", "for",
        "on", "with", "at", "by", "from", "as", "into", "through", "during",
        "before", "after", "above", "below", "between", "and", "but", "or",
        "not", "no", "nor", "so", "yet", "both", "either", "neither", "each",
        "every", "all", "any", "few", "more", "most", "other", "some", "such",
        "than", "too", "very", "just", "about", "also", "that", "this",
        "these", "those", "it", "its", "i", "me", "my", "we", "our", "you",
        "your", "he", "him", "his", "she", "her", "they", "them", "their",
    }

    words = re.findall(r'[a-z0-9]+', text.lower())
    return [w for w in words if w not in stopwords and len(w) > 1]


# --- CLI ---

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Memory Graph Retrieval")
    subparsers = parser.add_subparsers(dest="command")

    # retrieve
    p = subparsers.add_parser("retrieve", help="Retrieve relevant memories")
    p.add_argument("--query", required=True, help="Search query")
    p.add_argument("--graph", default="memory/graph.json")
    p.add_argument("--top-k", type=int, default=10)
    p.add_argument("--depth", type=int, default=2)
    p.add_argument("--min-confidence", type=int, default=20)
    p.add_argument("--exclude-categories", nargs="*", default=None,
                   help="Categories to exclude from retrieval")

    # search (simple text search, no ranking)
    p = subparsers.add_parser("search", help="Simple text search for nodes")
    p.add_argument("--query", required=True)
    p.add_argument("--graph", default="memory/graph.json")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    graph = load_graph(args.graph)

    if args.command == "retrieve":
        result = retrieve_relevant(
            graph, args.query, args.top_k, args.depth, args.min_confidence,
            exclude_categories=args.exclude_categories,
        )
        # Save graph (touch_node updates)
        from graph_ops import save_graph
        save_graph(graph, args.graph)
        print(json.dumps(result, indent=2))

    elif args.command == "search":
        results = find_nodes(graph, query=args.query)
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
