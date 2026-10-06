#!/usr/bin/env bash
set -euo pipefail

# deploy.sh for @goodandready/dsh-voice — canonical deployment and verification script.
#
# Delivery path: main -> quality gate (tests, package size, identity invariants) ->
# explicit owner approval -> install published immutable npm version into target profile.
#
# Usage:
#   ./deploy.sh             # pre-deploy checks only (tests, package size, identity)
#   ./deploy.sh --install   # install published @goodandready/dsh-voice into $DSH_PROFILE

PROFILE="${DSH_PROFILE:-web}"
PACKAGE="@goodandready/dsh-voice"

echo "== dsh-voice deploy checks (profile: ${PROFILE}) =="

echo "-- Test suite"
npm test

echo "-- npm package size check (DSH store limit: 262144 bytes per file)"
npm run pack:check

echo "-- Package identity check (name must match in four places)"
node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const patch = fs.readFileSync("cordis.patch.yml", "utf8");
const client = fs.readFileSync("lib/client.js", "utf8");
const server = fs.readFileSync("lib/index.js", "utf8");
const name = "@goodandready/dsh-voice";
if (pkg.name !== name) { console.error("IDENTITY MISMATCH in package.json"); process.exit(1); }
if (!patch.includes(name)) { console.error("IDENTITY MISMATCH in cordis.patch.yml"); process.exit(1); }
if (!client.includes("id: \x27" + name + "\x27")) { console.error("IDENTITY MISMATCH in lib/client.js"); process.exit(1); }
if (!server.includes("export const name = \x27" + name + "\x27")) { console.error("IDENTITY MISMATCH in lib/index.js"); process.exit(1); }
console.log("identity ok");
'

if [ "${1:-}" = "--install" ]; then
  echo "-- Installing published package into profile ${PROFILE}"
  dsh plugin --profile "$PROFILE" add --config.minimumReleaseAge=0 "$PACKAGE"
  echo "Installed $PACKAGE into profile $PROFILE; restart the profile service (e.g. sudo systemctl restart dsh-web.service)."
  echo "-- Verifying service status"
  sleep 2
  curl -s --max-time 10 http://127.0.0.1:3080/dsh-voice/status || true
else
  echo "Checks passed. Profile install runs with: $0 --install (published npm version, after owner approval)."
fi
