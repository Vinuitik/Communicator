# graphify_run.ps1 - Step 1: detect, cache check, AST extraction
# Output: uncached files list (for subagent dispatch), then run graphify_finish.ps1
param([string]$Path = ".")

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path graphify-out | Out-Null

python -c "import graphify" 2>$null
if ($LASTEXITCODE -ne 0) { pip install graphifyy -q 2>$null }

python -c @"
import json, sys
from graphify.detect import detect
from graphify.cache import check_semantic_cache
from graphify.extract import collect_files, extract
from pathlib import Path

# Detect
d = detect(Path(r'$Path'))
Path('.graphify_detect.json').write_text(json.dumps(d), encoding='utf-8')

# Cache check
all_files = [f for files in d['files'].values() for f in files]
cn, ce, ch, uncached = check_semantic_cache(all_files)
if cn or ce or ch:
    Path('.graphify_cached.json').write_text(json.dumps({'nodes': cn, 'edges': ce, 'hyperedges': ch}), encoding='utf-8')
Path('.graphify_uncached.txt').write_text('\n'.join(uncached), encoding='utf-8')

# AST extraction
code_files = []
for f in d.get('files', {}).get('code', []):
    p = Path(f)
    code_files.extend(collect_files(p) if p.is_dir() else [p])
result = extract(code_files) if code_files else {'nodes':[],'edges':[],'input_tokens':0,'output_tokens':0}
Path('.graphify_ast.json').write_text(json.dumps(result), encoding='utf-8')

# Output
non_code_uncached = [f for f in uncached if not any(f.endswith(e) for e in ['.py','.java','.js','.ts','.go','.rs','.ps1','.kt','.cs','.cpp','.c','.rb','.swift','.scala','.php'])]
print(f"Corpus: {d['total_files']} files, {d['total_words']} words")
print(f"Cache: {len(all_files)-len(uncached)} hit, {len(uncached)} miss ({len(non_code_uncached)} need semantic)")
if non_code_uncached:
    print("\nUncached non-code files (dispatch subagents for these):")
    for f in non_code_uncached:
        print(' ', f)
    print("\nThen: .\graphify_finish.ps1")
else:
    print("No semantic extraction needed. Run: .\graphify_finish.ps1")
"@ 2>$null
