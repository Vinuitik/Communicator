#!/usr/bin/env bash
# Runs every test suite in the repo — the Java Maven reactor, every Python
# microservice, and the React app — in one command. Silent on success (no
# stdout at all beyond nothing); dumps full diagnostic output ONLY for
# components that actually fail, so a clean run doesn't pollute an agent's
# context and a failing one gives everything needed to debug without re-running.
#
# A Python/React component with zero real test files is silently skipped
# (not a failure) — this repo currently only has tests in the friend module;
# this script is written to pick up tests in any other module/service the
# moment they're added, with no changes needed here.
#
# Usage: ./run-all-tests.sh          (silent unless something fails)
#        ./run-all-tests.sh -v       (verbose: prints the [OK]/[SKIP]/[FAIL]
#                                      summary even on full success)
#
# Exit code: 0 if everything passed or had no tests, 1 if anything failed.

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"

VERBOSE=0
[ "${1:-}" = "-v" ] && VERBOSE=1

FAILED=0
SUMMARY=()
MAVEN_CACHE_VOLUME="communicator-maven-repo"
VENV_ROOT="/tmp/communicator-test-venvs"

# Runs "$@", capturing output. Prints nothing on success; on failure, dumps
# the captured log (tail-limited) and marks the overall run as failed.
run_component() {
    local name="$1"; shift
    local logfile
    logfile="$(mktemp)"
    if "$@" > "$logfile" 2>&1; then
        SUMMARY+=("[OK]   $name")
        rm -f "$logfile"
    else
        FAILED=1
        SUMMARY+=("[FAIL] $name")
        echo "===== $name FAILED ====="
        tail -n 200 "$logfile"
        echo "===== end $name ====="
        echo
        rm -f "$logfile"
    fi
}

find_test_files() {
    # $1 = dir, $2.. = -iname patterns (OR'd)
    local dir="$1"; shift
    local expr=()
    for pat in "$@"; do
        [ ${#expr[@]} -gt 0 ] && expr+=(-o)
        expr+=(-iname "$pat")
    done
    find "$dir" \( "${expr[@]}" \) \
        -not -path "*/.venv/*" -not -path "*/venv/*" \
        -not -path "*/__pycache__/*" -not -path "*/node_modules/*" \
        -not -path "*/target/*" 2>/dev/null
}

# ── Java reactor: knowledge-core, friend, group, connections, chrono, backup, bootstrap ──
run_component "java-reactor" \
    docker run --rm \
        -v "$(pwd)":/app -w /app \
        -v "${MAVEN_CACHE_VOLUME}":/root/.m2 \
        maven:3.9.6-eclipse-temurin-21 \
        mvn -B -q test

# ── Python microservices (only if real, non-vendored test files exist) ──
for svc in ai_agent host-wrapper embedder resourceRepository data-extraction; do
    [ -d "$svc" ] || continue
    tests_found="$(find_test_files "$svc" "test_*.py" "*_test.py")"
    if [ -z "$tests_found" ]; then
        SUMMARY+=("[SKIP] $svc (no test files)")
        continue
    fi
    run_component "$svc" bash -c "
        set -e
        python3 -m venv '${VENV_ROOT}/${svc}' 2>/dev/null || true
        '${VENV_ROOT}/${svc}/bin/pip' install -q -r '$svc/requirements.txt' pytest
        cd '$svc' && '${VENV_ROOT}/${svc}/bin/pytest' -q
    "
done

# ── React ──
tests_found="$(find_test_files react/src "*.test.ts" "*.test.tsx")"
if [ -z "$tests_found" ]; then
    SUMMARY+=("[SKIP] react (no test files)")
else
    run_component "react" bash -c "cd react && CI=true npm test -- --watchAll=false"
fi

if [ "$VERBOSE" -eq 1 ] || [ "$FAILED" -eq 1 ]; then
    echo
    printf '%s\n' "${SUMMARY[@]}"
fi

if [ "$FAILED" -eq 1 ]; then
    echo
    echo "SOME TEST SUITES FAILED — see logs above."
    exit 1
fi
exit 0
