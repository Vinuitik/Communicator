# graphify_finish.ps1 - Step 2: merge chunks, build graph, cluster, report
# Usage:
#   .\graphify_finish.ps1                     -> merge + cluster, print compact community table
#   .\graphify_finish.ps1 -LabelsFile f.json  -> apply labels, generate report+HTML, print key sections
param([string]$LabelsFile = "")

$ErrorActionPreference = "Stop"

# Merge chunk files + cached semantic into .graphify_semantic.json
python -c @"
import json
from graphify.cache import save_semantic_cache
from pathlib import Path

all_nodes, all_edges, all_hyperedges = [], [], []
total_in, total_out = 0, 0
i = 1
while True:
    p = Path('graphify-out') / f'.graphify_chunk_{i:02d}.json'
    if not p.exists():
        break
    data = json.loads(p.read_text(encoding='utf-8'))
    all_nodes += data.get('nodes', [])
    all_edges += data.get('edges', [])
    all_hyperedges += data.get('hyperedges', [])
    total_in += int(data.get('input_tokens', 0) or 0)
    total_out += int(data.get('output_tokens', 0) or 0)
    i += 1

if all_nodes:
    save_semantic_cache(all_nodes, all_edges, all_hyperedges)

cached = json.loads(Path('.graphify_cached.json').read_text(encoding='utf-8')) if Path('.graphify_cached.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
all_nodes = cached['nodes'] + all_nodes
all_edges = cached['edges'] + all_edges
all_hyperedges = cached.get('hyperedges', []) + all_hyperedges

seen = set()
deduped = [n for n in all_nodes if n['id'] not in seen and not seen.add(n['id'])]
Path('.graphify_semantic.json').write_text(json.dumps({'nodes': deduped, 'edges': all_edges, 'hyperedges': all_hyperedges, 'input_tokens': total_in, 'output_tokens': total_out}), encoding='utf-8')
"@ 2>$null

# Merge AST + semantic
python -c @"
import json
from pathlib import Path

ast = json.loads(Path('.graphify_ast.json').read_text(encoding='utf-8'))
sem = json.loads(Path('.graphify_semantic.json').read_text(encoding='utf-8'))
seen = set(n['id'] for n in ast['nodes'])
merged_nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])
merged = {
    'nodes': merged_nodes,
    'edges': ast['edges'] + sem['edges'],
    'hyperedges': sem.get('hyperedges',[]),
    'input_tokens': int(sem.get('input_tokens',0) or 0),
    'output_tokens': int(sem.get('output_tokens',0) or 0),
}
Path('.graphify_extract.json').write_text(json.dumps(merged), encoding='utf-8')
"@ 2>$null

# Build + cluster + save analysis
python -c @"
import json
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.export import to_json
from pathlib import Path

G = build_from_json(json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8')))
communities = cluster(G)
cohesion = score_all(G, communities)
labels_placeholder = {cid: 'Community ' + str(cid) for cid in communities}
analysis = {
    'communities': {str(k): v for k, v in communities.items()},
    'cohesion': {str(k): v for k, v in cohesion.items()},
    'gods': god_nodes(G),
    'surprises': surprising_connections(G, communities),
    'questions': suggest_questions(G, communities, labels_placeholder),
}
Path('.graphify_analysis.json').write_text(json.dumps(analysis), encoding='utf-8')
to_json(G, communities, 'graphify-out/graph.json')
print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')
"@ 2>$null

if ($LabelsFile -eq "") {
    # Print compact community table for labeling
    python -c @"
import json
from pathlib import Path
analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding='utf-8'))
extract = json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8'))
node_map = {n['id']: n['label'] for n in extract['nodes']}
for cid, nids in sorted(analysis['communities'].items(), key=lambda x: -len(x[1])):
    sample = ', '.join(node_map.get(n, n) for n in nids[:3])
    print(f'C{cid}({len(nids)}): {sample}')
"@
    Write-Host ""
    Write-Host "Write labels to graphify_labels.json, then: .\graphify_finish.ps1 -LabelsFile graphify_labels.json"
} else {
    # Apply labels, generate report + HTML, print key sections
    python -c @"
import json, re
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_html
from graphify.detect import save_manifest
from pathlib import Path
from datetime import datetime, timezone

extraction = json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8'))
detection  = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))
analysis   = json.loads(Path('.graphify_analysis.json').read_text(encoding='utf-8'))
labels_raw = json.loads(Path(r'$LabelsFile').read_text(encoding='utf-8'))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion    = {int(k): v for k, v in analysis['cohesion'].items()}
labels      = {int(k): v for k, v in labels_raw.items()}
tokens      = {'input': extraction.get('input_tokens',0), 'output': extraction.get('output_tokens',0)}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')

if G.number_of_nodes() <= 5000:
    to_html(G, communities, 'graphify-out/graph.html', community_labels=labels)

save_manifest(detection['files'])
cost_path = Path('graphify-out/cost.json')
cost = json.loads(cost_path.read_text(encoding='utf-8')) if cost_path.exists() else {'runs':[], 'total_input_tokens':0, 'total_output_tokens':0}
cost['runs'].append({'date': datetime.now(timezone.utc).isoformat(), 'input_tokens': tokens['input'], 'output_tokens': tokens['output'], 'files': detection.get('total_files',0)})
cost['total_input_tokens'] += int(tokens['input'] or 0)
cost['total_output_tokens'] += int(tokens['output'] or 0)
cost_path.write_text(json.dumps(cost, indent=2), encoding='utf-8')

for section in ['God Nodes', 'Surprising Connections', 'Suggested Questions']:
    m = re.search(r'(## ' + section + r'.*?)(?=\n## |\Z)', report, re.DOTALL)
    if m:
        print(m.group(1)[:1200])
        print()
"@ 2>$null

    # Cleanup
    Remove-Item -ErrorAction SilentlyContinue .graphify_detect.json,.graphify_extract.json,.graphify_ast.json,.graphify_semantic.json,.graphify_analysis.json,.graphify_cached.json,.graphify_uncached.txt
    Get-ChildItem graphify-out -Filter ".graphify_chunk_*.json" -ErrorAction SilentlyContinue | Remove-Item
    Write-Host "Done. graphify-out/graph.html + GRAPH_REPORT.md"
}
