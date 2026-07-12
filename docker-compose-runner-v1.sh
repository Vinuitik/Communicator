#!/usr/bin/env bash
# Docker Compose Runner with Automatic Timezone Detection (Linux)
# Detects the host timezone (already in IANA format on Linux), exports it as
# HOST_TIMEZONE, then runs docker compose build followed by docker compose up -d.

set -euo pipefail

# --- Colors (fall back to plain text if not a terminal) ---
if [ -t 1 ]; then
    RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
    BLUE=$'\033[0;34m'; CYAN=$'\033[0;36m'; NC=$'\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi

# --- Detect the host timezone (IANA format, e.g. Europe/Kiev) ---
detect_timezone() {
    if command -v timedatectl >/dev/null 2>&1; then
        local tz
        tz=$(timedatectl show -p Timezone --value 2>/dev/null || true)
        [ -n "$tz" ] && { echo "$tz"; return; }
    fi
    if [ -f /etc/timezone ]; then
        cat /etc/timezone && return
    fi
    if [ -L /etc/localtime ]; then
        # Resolve symlink like /usr/share/zoneinfo/Europe/Kiev -> Europe/Kiev
        readlink -f /etc/localtime | sed 's#.*/zoneinfo/##' && return
    fi
    echo ""
}

HOST_TIMEZONE=$(detect_timezone)
if [ -z "$HOST_TIMEZONE" ]; then
    echo "${YELLOW}Could not detect host timezone - defaulting to UTC${NC}"
    HOST_TIMEZONE="UTC"
fi
export HOST_TIMEZONE
echo "${GREEN}Using timezone: ${HOST_TIMEZONE}${NC}"

# --- Pick the docker compose command (v2 plugin or legacy v1) ---
if docker compose version >/dev/null 2>&1; then
    DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
else
    echo "${RED}Neither 'docker compose' nor 'docker-compose' is installed.${NC}"
    exit 1
fi

run_compose() {
    echo
    echo "${BLUE}Running: ${DC} $*${NC}"
    if $DC "$@"; then
        echo "${GREEN}Command completed successfully!${NC}"
    else
        echo "${RED}Command failed with exit code: $?${NC}"
        return 1
    fi
}

# --- Build then start ---
echo
echo "${CYAN}Building containers...${NC}"
run_compose build

echo
echo "${CYAN}Starting containers...${NC}"
run_compose up -d

echo
echo "${GREEN}Containers are now running in the background with timezone (${HOST_TIMEZONE})${NC}"
echo "${CYAN}To view logs:        ${DC} logs -f${NC}"
echo "${CYAN}To stop containers:  ${DC} down${NC}"
