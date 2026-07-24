FROM cloudflare/cloudflared:latest

# WORKDIR creates /etc/cloudflared with normal 0755 perms first — COPY --chmod
# on a not-yet-existing destination directory applies that SAME restrictive
# mode to the auto-created directory too, which with 444 (no execute/traverse
# bit) locks everyone out of it, including root. Create it normally first.
WORKDIR /etc/cloudflared

# cloudflared tunnel token writes credentials.json owner-read-only (0400) for
# the host user; the container runs as a different UID (65532, "nonroot" —
# see base image), so it can't read it as-copied without this. Base image has
# no shell at all (no /bin/sh — RUN chmod isn't an option here), and this
# image is local-only (never pushed), so world-read via --chmod is a non-issue.
COPY --chmod=444 config.yml config.yml
COPY --chmod=444 credentials.json credentials.json

CMD ["tunnel", "--config", "/etc/cloudflared/config.yml", "run"]
