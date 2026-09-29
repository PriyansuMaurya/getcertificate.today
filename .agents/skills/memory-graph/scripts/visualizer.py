#!/usr/bin/env python3
"""
Memory Graph - Interactive Visualization Generator

Generates an interactive force-directed graph visualization using D3.js.
Output is a standalone HTML file that can be opened in any browser.
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent))
from graph_ops import load_graph


# Category color palette
CATEGORY_COLORS = {
    "Career": "#4A90D9",
    "Learning": "#7B68EE",
    "Research": "#2ECC71",
    "Projects": "#E67E22",
    "Skills": "#E74C3C",
    "Preferences": "#9B59B6",
    "Habits": "#1ABC9C",
    "Decisions": "#F39C12",
    "Relationships": "#E91E63",
    "Personal Knowledge": "#00BCD4",
    "Long-term Goals": "#FF6B6B",
}

# Relationship type colors
EDGE_COLORS = {
    "Related To": "#888888",
    "Supports": "#2ECC71",
    "Contradicts": "#E74C3C",
    "Similar To": "#3498DB",
    "Opposite Of": "#E67E22",
    "Depends On": "#9B59B6",
    "Causes": "#F39C12",
    "Enables": "#1ABC9C",
    "Requires": "#E91E63",
    "Blocks": "#C0392B",
    "Derived From": "#7F8C8D",
    "Builds Upon": "#27AE60",
    "Improves": "#2980B9",
    "Influences": "#8E44AD",
    "Goal": "#FF6B6B",
    "Project": "#E67E22",
    "Preference": "#9B59B6",
    "Interest": "#3498DB",
    "Habit": "#1ABC9C",
    "Skill": "#E74C3C",
    "Person": "#E91E63",
    "Experience": "#F39C12",
}


def generate_visualization(graph: dict, output_path: str = "memory/graph.html") -> str:
    """Generate an interactive D3.js visualization of the graph."""
    # Convert graph to D3 format
    d3_data = _graph_to_d3(graph)

    # Generate HTML
    html = _generate_html(d3_data, graph)

    # Write to file
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Visualization saved to {output_path}")
    return str(path)


def _graph_to_d3(graph: dict) -> dict:
    """Convert internal graph format to D3.js force graph format."""
    now = datetime.now(timezone.utc)

    nodes = []
    for node in graph["nodes"].values():
        # Skip archived nodes unless they have active connections
        if node["status"] == "Archived":
            continue

        # Calculate recency glow
        last_accessed = node.get("last_accessed", node.get("created_at", ""))
        recency = _compute_recency(last_accessed, now)

        nodes.append({
            "id": node["id"],
            "title": node["title"],
            "summary": node["summary"],
            "category": node["category"],
            "confidence": node["confidence"],
            "importance": node["importance"],
            "status": node["status"],
            "retrieval_frequency": node.get("retrieval_frequency", 0),
            "color": CATEGORY_COLORS.get(node["category"], "#888888"),
            "recency": recency,
            "tags": node.get("tags", {}).get("user", []) + node.get("tags", {}).get("ai", []),
        })

    links = []
    for edge in graph["edges"].values():
        # Only include edges where both nodes exist in our node list
        node_ids = {n["id"] for n in nodes}
        if edge["source"] in node_ids and edge["target"] in node_ids:
            links.append({
                "source": edge["source"],
                "target": edge["target"],
                "type": edge["type"],
                "strength": edge["strength"],
                "confidence": edge["confidence"],
                "explanation": edge.get("explanation", ""),
                "color": EDGE_COLORS.get(edge["type"], "#888888"),
            })

    return {"nodes": nodes, "links": links}


def _compute_recency(last_accessed: str, now: datetime) -> float:
    """Compute recency score (0-1) for glow effect."""
    if not last_accessed:
        return 0.3

    try:
        last_dt = datetime.fromisoformat(last_accessed.replace("Z", "+00:00"))
        days = (now - last_dt).days

        if days <= 1:
            return 1.0
        elif days <= 7:
            return 0.8
        elif days <= 30:
            return 0.5
        elif days <= 90:
            return 0.3
        else:
            return 0.1
    except (ValueError, TypeError):
        return 0.3


def _generate_html(d3_data: dict, graph: dict) -> str:
    """Generate the complete HTML visualization."""
    nodes_json = json.dumps(d3_data["nodes"])
    links_json = json.dumps(d3_data["links"])
    categories_json = json.dumps(list(CATEGORY_COLORS.keys()))
    edge_types_json = json.dumps(list(EDGE_COLORS.keys()))

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memory Graph Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; overflow: hidden; }}

        #container {{ display: flex; height: 100vh; }}

        /* Sidebar */
        #sidebar {{
            width: 320px; background: #12121a; border-right: 1px solid #2a2a3a;
            display: flex; flex-direction: column; overflow: hidden;
        }}
        #sidebar-header {{
            padding: 16px; border-bottom: 1px solid #2a2a3a;
        }}
        #sidebar-header h1 {{
            font-size: 18px; font-weight: 600; color: #fff;
            display: flex; align-items: center; gap: 8px;
        }}
        #sidebar-header h1::before {{
            content: '🧠'; font-size: 24px;
        }}
        .stats {{
            display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;
        }}
        .stat {{
            background: #1a1a2e; padding: 8px 12px; border-radius: 8px;
        }}
        .stat-label {{ font-size: 11px; color: #888; text-transform: uppercase; }}
        .stat-value {{ font-size: 18px; font-weight: 600; color: #fff; }}

        /* Search */
        #search-container {{ padding: 12px 16px; }}
        #search-input {{
            width: 100%; padding: 10px 12px; background: #1a1a2e;
            border: 1px solid #2a2a3a; border-radius: 8px; color: #fff;
            font-size: 14px; outline: none; transition: border-color 0.2s;
        }}
        #search-input:focus {{ border-color: #4A90D9; }}
        #search-input::placeholder {{ color: #666; }}

        /* Filters */
        #filters {{ padding: 12px 16px; border-bottom: 1px solid #2a2a3a; }}
        .filter-group {{ margin-bottom: 12px; }}
        .filter-label {{
            font-size: 11px; text-transform: uppercase; color: #888;
            margin-bottom: 6px; display: block;
        }}
        .filter-chips {{ display: flex; flex-wrap: wrap; gap: 4px; }}
        .chip {{
            padding: 4px 10px; border-radius: 12px; font-size: 12px;
            cursor: pointer; transition: all 0.2s; border: 1px solid #2a2a3a;
            background: #1a1a2e; color: #aaa;
        }}
        .chip.active {{ background: #2a2a4a; border-color: #4A90D9; color: #fff; }}
        .chip:hover {{ border-color: #4A90D9; }}

        /* Node list */
        #node-list {{
            flex: 1; overflow-y: auto; padding: 8px;
        }}
        #node-list::-webkit-scrollbar {{ width: 6px; }}
        #node-list::-webkit-scrollbar-track {{ background: transparent; }}
        #node-list::-webkit-scrollbar-thumb {{ background: #2a2a3a; border-radius: 3px; }}

        .node-item {{
            padding: 10px 12px; border-radius: 8px; cursor: pointer;
            transition: all 0.2s; margin-bottom: 4px;
        }}
        .node-item:hover {{ background: #1a1a2e; }}
        .node-item.selected {{ background: #2a2a4a; border: 1px solid #4A90D9; }}
        .node-item-title {{ font-size: 13px; font-weight: 500; color: #fff; }}
        .node-item-meta {{
            display: flex; gap: 8px; margin-top: 4px; font-size: 11px; color: #888;
        }}
        .node-item-category {{
            padding: 1px 6px; border-radius: 4px; font-size: 10px;
        }}

        /* Detail panel */
        #detail-panel {{
            position: absolute; right: 16px; top: 16px; width: 360px;
            background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px;
            padding: 20px; display: none; max-height: calc(100vh - 32px);
            overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }}
        #detail-panel.visible {{ display: block; }}
        #detail-close {{
            position: absolute; top: 12px; right: 12px; background: none;
            border: none; color: #888; cursor: pointer; font-size: 18px;
        }}
        #detail-title {{ font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 8px; }}
        #detail-summary {{ font-size: 13px; color: #aaa; margin-bottom: 16px; line-height: 1.5; }}
        .detail-section {{ margin-bottom: 16px; }}
        .detail-section-title {{
            font-size: 11px; text-transform: uppercase; color: #888;
            margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #2a2a3a;
        }}
        .detail-row {{
            display: flex; justify-content: space-between; padding: 4px 0;
            font-size: 13px;
        }}
        .detail-row-label {{ color: #888; }}
        .detail-row-value {{ color: #fff; }}
        .confidence-bar {{
            width: 100%; height: 6px; background: #1a1a2e; border-radius: 3px;
            margin-top: 4px;
        }}
        .confidence-fill {{
            height: 100%; border-radius: 3px; transition: width 0.3s;
        }}
        .connections-list {{ list-style: none; }}
        .connections-list li {{
            padding: 6px 0; font-size: 12px; color: #aaa;
            border-bottom: 1px solid #1a1a2e;
        }}
        .connection-type {{
            display: inline-block; padding: 1px 6px; border-radius: 4px;
            font-size: 10px; margin-right: 6px;
        }}

        /* Graph */
        #graph-container {{
            flex: 1; position: relative;
        }}
        #graph {{ width: 100%; height: 100%; }}

        /* Controls */
        #controls {{
            position: absolute; bottom: 16px; right: 16px;
            display: flex; flex-direction: column; gap: 8px;
        }}
        .control-btn {{
            width: 40px; height: 40px; border-radius: 8px;
            background: #12121a; border: 1px solid #2a2a3a;
            color: #fff; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            font-size: 18px; transition: all 0.2s;
        }}
        .control-btn:hover {{ background: #2a2a4a; border-color: #4A90D9; }}

        /* Legend */
        #legend {{
            position: absolute; bottom: 16px; left: 16px;
            background: #12121a; border: 1px solid #2a2a3a;
            border-radius: 8px; padding: 12px; font-size: 11px;
        }}
        .legend-title {{ font-weight: 600; margin-bottom: 8px; color: #fff; }}
        .legend-item {{
            display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
        }}
        .legend-color {{
            width: 12px; height: 12px; border-radius: 3px;
        }}

        /* Tooltip */
        #tooltip {{
            position: absolute; background: #1a1a2e; border: 1px solid #2a2a3a;
            border-radius: 8px; padding: 10px 14px; font-size: 12px;
            pointer-events: none; opacity: 0; transition: opacity 0.2s;
            max-width: 250px; z-index: 100;
        }}
        #tooltip.visible {{ opacity: 1; }}
        #tooltip-title {{ font-weight: 600; color: #fff; margin-bottom: 4px; }}
        #tooltip-meta {{ color: #888; }}
    </style>
</head>
<body>
    <div id="container">
        <div id="sidebar">
            <div id="sidebar-header">
                <h1>Memory Graph</h1>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">Nodes</div>
                        <div class="stat-value">{len(d3_data['nodes'])}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Edges</div>
                        <div class="stat-value">{len(d3_data['links'])}</div>
                    </div>
                </div>
            </div>
            <div id="search-container">
                <input type="text" id="search-input" placeholder="Search memories...">
            </div>
            <div id="filters">
                <div class="filter-group">
                    <span class="filter-label">Categories</span>
                    <div class="filter-chips" id="category-filters"></div>
                </div>
                <div class="filter-group">
                    <span class="filter-label">Min Confidence</span>
                    <input type="range" id="confidence-filter" min="0" max="100" value="0"
                        style="width: 100%; accent-color: #4A90D9;">
                    <span id="confidence-value" style="font-size: 12px; color: #888;">0%</span>
                </div>
            </div>
            <div id="node-list"></div>
        </div>

        <div id="graph-container">
            <svg id="graph"></svg>
            <div id="controls">
                <button class="control-btn" id="zoom-in" title="Zoom in">+</button>
                <button class="control-btn" id="zoom-out" title="Zoom out">−</button>
                <button class="control-btn" id="zoom-reset" title="Reset view">⟲</button>
                <button class="control-btn" id="toggle-labels" title="Toggle labels">Aa</button>
            </div>
            <div id="legend">
                <div class="legend-title">Categories</div>
                <div id="legend-items"></div>
            </div>
        </div>
    </div>

    <div id="detail-panel">
        <button id="detail-close">×</button>
        <div id="detail-title"></div>
        <div id="detail-summary"></div>
        <div class="detail-section">
            <div class="detail-section-title">Properties</div>
            <div id="detail-properties"></div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">Confidence</div>
            <div class="confidence-bar">
                <div class="confidence-fill" id="detail-confidence-bar"></div>
            </div>
            <div id="detail-confidence-text" style="font-size: 12px; color: #888; margin-top: 4px;"></div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">Connections</div>
            <ul class="connections-list" id="detail-connections"></ul>
        </div>
    </div>

    <div id="tooltip">
        <div id="tooltip-title"></div>
        <div id="tooltip-meta"></div>
    </div>

    <script>
    // Data
    const nodesData = {nodes_json};
    const linksData = {links_json};
    const categories = {categories_json};
    const edgeTypes = {edge_types_json};

    // State
    let selectedNode = null;
    let showLabels = true;
    let activeCategories = new Set(categories);
    let minConfidence = 0;
    let searchQuery = '';

    // Setup SVG
    const container = document.getElementById('graph-container');
    const svg = d3.select('#graph');
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Zoom
    const g = svg.append('g');
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Arrow markers for directed edges
    const defs = svg.append('defs');
    Object.entries({{{json.dumps(EDGE_COLORS)}}}).forEach(([type, color]) => {{
        defs.append('marker')
            .attr('id', `arrow-${{type.replace(/\\s+/g, '-')}}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', color);
    }});

    // Force simulation
    const simulation = d3.forceSimulation(nodesData)
        .force('link', d3.forceLink(linksData).id(d => d.id).distance(d => 150 - d.strength))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 10));

    // Links
    const link = g.append('g')
        .selectAll('line')
        .data(linksData)
        .join('line')
        .attr('stroke', d => d.color)
        .attr('stroke-opacity', d => d.confidence / 100 * 0.6 + 0.1)
        .attr('stroke-width', d => Math.max(1, d.strength / 20))
        .attr('marker-end', d => `url(#arrow-${{d.type.replace(/\\s+/g, '-')}})`);

    // Node groups
    const node = g.append('g')
        .selectAll('g')
        .data(nodesData)
        .join('g')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Node circles
    node.append('circle')
        .attr('r', d => getNodeRadius(d))
        .attr('fill', d => d.color)
        .attr('stroke', d => d.status === 'Dormant' ? '#555' : '#fff')
        .attr('stroke-width', d => d.confidence / 50)
        .attr('stroke-opacity', d => d.status === 'Dormant' ? 0.3 : 0.8)
        .style('filter', d => d.recency > 0.7 ? `drop-shadow(0 0 ${{d.recency * 8}}px ${{d.color}})` : 'none')
        .style('cursor', 'pointer');

    // Node labels
    const labels = node.append('text')
        .text(d => d.title.length > 25 ? d.title.substring(0, 25) + '…' : d.title)
        .attr('dy', d => getNodeRadius(d) + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#ccc')
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .style('pointer-events', 'none');

    // Interaction
    node.on('click', (event, d) => {{
        event.stopPropagation();
        selectNode(d);
    }});

    node.on('mouseover', (event, d) => {{
        const tooltip = document.getElementById('tooltip');
        document.getElementById('tooltip-title').textContent = d.title;
        document.getElementById('tooltip-meta').textContent =
            `${{d.category}} • Confidence: ${{d.confidence}}% • Importance: ${{d.importance}}`;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
        tooltip.classList.add('visible');

        // Highlight neighbors
        const neighbors = new Set();
        linksData.forEach(l => {{
            if (l.source.id === d.id) neighbors.add(l.target.id);
            if (l.target.id === d.id) neighbors.add(l.source.id);
        }});
        neighbors.add(d.id);

        node.style('opacity', n => neighbors.has(n.id) ? 1 : 0.2);
        link.style('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);
    }});

    node.on('mouseout', () => {{
        document.getElementById('tooltip').classList.remove('visible');
        if (!selectedNode) {{
            node.style('opacity', 1);
            link.style('opacity', d => d.confidence / 100 * 0.6 + 0.1);
        }}
    }});

    svg.on('click', () => {{
        selectedNode = null;
        node.style('opacity', 1);
        link.style('opacity', d => d.confidence / 100 * 0.6 + 0.1);
        document.getElementById('detail-panel').classList.remove('visible');
        document.querySelectorAll('.node-item').forEach(el => el.classList.remove('selected'));
    }});

    // Simulation tick
    simulation.on('tick', () => {{
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${{d.x}},${{d.y}})`);
    }});

    // Drag functions
    function dragstarted(event) {{
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }}
    function dragged(event) {{
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }}
    function dragended(event) {{
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }}

    // Helper functions
    function getNodeRadius(d) {{
        return Math.max(8, d.importance * 3 + d.confidence / 20);
    }}

    function selectNode(d) {{
        selectedNode = d;

        // Highlight selected and neighbors
        const neighbors = new Set();
        linksData.forEach(l => {{
            if (l.source.id === d.id) neighbors.add(l.target.id);
            if (l.target.id === d.id) neighbors.add(l.source.id);
        }});
        neighbors.add(d.id);

        node.style('opacity', n => neighbors.has(n.id) ? 1 : 0.2);
        link.style('opacity', l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.1);

        // Update sidebar selection
        document.querySelectorAll('.node-item').forEach(el => {{
            el.classList.toggle('selected', el.dataset.id === d.id);
        }});

        // Show detail panel
        showDetailPanel(d);
    }}

    function showDetailPanel(d) {{
        const panel = document.getElementById('detail-panel');
        document.getElementById('detail-title').textContent = d.title;
        document.getElementById('detail-summary').textContent = d.summary;

        // Properties
        document.getElementById('detail-properties').innerHTML = `
            <div class="detail-row"><span class="detail-row-label">Category</span><span class="detail-row-value">${{d.category}}</span></div>
            <div class="detail-row"><span class="detail-row-label">Importance</span><span class="detail-row-value">${{d.importance}}/10</span></div>
            <div class="detail-row"><span class="detail-row-label">Status</span><span class="detail-row-value">${{d.status}}</span></div>
            <div class="detail-row"><span class="detail-row-label">Retrieved</span><span class="detail-row-value">${{d.retrieval_frequency}}×</span></div>
        `;

        // Confidence bar
        const confBar = document.getElementById('detail-confidence-bar');
        confBar.style.width = d.confidence + '%';
        confBar.style.background = d.confidence > 70 ? '#2ECC71' : d.confidence > 40 ? '#F39C12' : '#E74C3C';
        document.getElementById('detail-confidence-text').textContent = `${{d.confidence}}% confidence`;

        // Connections
        const connList = document.getElementById('detail-connections');
        connList.innerHTML = '';
        linksData.forEach(l => {{
            if (l.source.id === d.id || l.target.id === d.id) {{
                const other = l.source.id === d.id ? l.target : l.source;
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="connection-type" style="background: ${{l.color}}33; color: ${{l.color}}">${{l.type}}</span>
                    <span>${{other.title}}</span>
                `;
                connList.appendChild(li);
            }}
        }});

        panel.classList.add('visible');
    }}

    // Sidebar node list
    function renderNodeList() {{
        const list = document.getElementById('node-list');
        list.innerHTML = '';

        const filtered = nodesData.filter(n => {{
            if (!activeCategories.has(n.category)) return false;
            if (n.confidence < minConfidence) return false;
            if (searchQuery && !n.title.toLowerCase().includes(searchQuery) &&
                !n.summary.toLowerCase().includes(searchQuery)) return false;
            return true;
        }});

        filtered.sort((a, b) => (b.importance * b.confidence) - (a.importance * a.confidence));

        filtered.forEach(n => {{
            const div = document.createElement('div');
            div.className = 'node-item' + (selectedNode?.id === n.id ? ' selected' : '');
            div.dataset.id = n.id;
            div.innerHTML = `
                <div class="node-item-title">${{n.title}}</div>
                <div class="node-item-meta">
                    <span class="node-item-category" style="background: ${{n.color}}33; color: ${{n.color}}">${{n.category}}</span>
                    <span>${{n.confidence}}%</span>
                    <span>★${{n.importance}}</span>
                </div>
            `;
            div.addEventListener('click', () => selectNode(n));
            list.appendChild(div);
        }});
    }}

    // Category filters
    function renderCategoryFilters() {{
        const container = document.getElementById('category-filters');
        container.innerHTML = '';
        categories.forEach(cat => {{
            const chip = document.createElement('span');
            chip.className = 'chip' + (activeCategories.has(cat) ? ' active' : '');
            chip.textContent = cat;
            chip.addEventListener('click', () => {{
                if (activeCategories.has(cat)) activeCategories.delete(cat);
                else activeCategories.add(cat);
                chip.classList.toggle('active');
                renderNodeList();
                updateVisibility();
            }});
            container.appendChild(chip);
        }});
    }}

    // Legend
    function renderLegend() {{
        const container = document.getElementById('legend-items');
        container.innerHTML = '';
        Object.entries({{{json.dumps(CATEGORY_COLORS)}}}).forEach(([cat, color]) => {{
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="legend-color" style="background: ${{color}}"></span><span>${{cat}}</span>`;
            container.appendChild(div);
        }});
    }}

    // Visibility update
    function updateVisibility() {{
        node.style('display', d => {{
            if (!activeCategories.has(d.category)) return 'none';
            if (d.confidence < minConfidence) return 'none';
            return 'block';
        }});
        link.style('display', l => {{
            const s = nodesData.find(n => n.id === (l.source.id || l.source));
            const t = nodesData.find(n => n.id === (l.target.id || l.target));
            if (!s || !t) return 'none';
            if (!activeCategories.has(s.category) || !activeCategories.has(t.category)) return 'none';
            return 'block';
        }});
    }}

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {{
        searchQuery = e.target.value.toLowerCase();
        renderNodeList();

        if (searchQuery) {{
            const matches = nodesData.filter(n =>
                n.title.toLowerCase().includes(searchQuery) ||
                n.summary.toLowerCase().includes(searchQuery)
            );
            if (matches.length > 0) {{
                const matchIds = new Set(matches.map(m => m.id));
                node.style('opacity', n => matchIds.has(n.id) ? 1 : 0.2);
            }}
        }} else if (!selectedNode) {{
            node.style('opacity', 1);
        }}
    }});

    // Confidence filter
    document.getElementById('confidence-filter').addEventListener('input', (e) => {{
        minConfidence = parseInt(e.target.value);
        document.getElementById('confidence-value').textContent = minConfidence + '%';
        renderNodeList();
        updateVisibility();
    }});

    // Controls
    document.getElementById('zoom-in').addEventListener('click', () => {{
        svg.transition().duration(300).call(zoom.scaleBy, 1.3);
    }});
    document.getElementById('zoom-out').addEventListener('click', () => {{
        svg.transition().duration(300).call(zoom.scaleBy, 0.7);
    }});
    document.getElementById('zoom-reset').addEventListener('click', () => {{
        svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    }});
    document.getElementById('toggle-labels').addEventListener('click', () => {{
        showLabels = !showLabels;
        labels.style('display', showLabels ? 'block' : 'none');
    }});

    // Detail panel close
    document.getElementById('detail-close').addEventListener('click', () => {{
        document.getElementById('detail-panel').classList.remove('visible');
        selectedNode = null;
        node.style('opacity', 1);
        link.style('opacity', d => d.confidence / 100 * 0.6 + 0.1);
    }});

    // Initial render
    renderCategoryFilters();
    renderNodeList();
    renderLegend();
    </script>
</body>
</html>'''


# --- CLI ---

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Memory Graph Visualization")
    parser.add_argument("--graph", default="memory/graph.json", help="Path to graph.json")
    parser.add_argument("--output", default="memory/graph.html", help="Output HTML path")

    args = parser.parse_args()

    graph = load_graph(args.graph)
    generate_visualization(graph, args.output)


if __name__ == "__main__":
    main()
