# Container Scan Triage Policy

This project uses Trivy in CI (`container-image-scan`) to scan the Docker image.

## Scope

- Scan target: image built from project `Dockerfile`
- Vulnerability classes: OS and library
- Severity gate: HIGH and CRITICAL (pipeline fails)
- Mode: `ignore-unfixed: true`

## Triage steps

1. Confirm whether finding belongs to runtime image or build stage only.
2. Check fix availability in upstream package/image.
3. Classify exploitability for this app context.
4. Apply remediation or document temporary acceptance.

## Remediation priority

- CRITICAL with fix available: patch before merge/release.
- HIGH with fix available: patch in current sprint.
- No fix available: track and re-evaluate on base image updates.

## Accepted risk record (temporary)

For each temporarily accepted finding, record:

- package and installed version
- affected layer (runtime/build)
- severity and advisory ID
- reason for temporary acceptance
- expiry/review date

Store entries in PR description and follow-up issue.

## Operational guidance

- Prefer pinning base images to updated minor/patch tags.
- Re-run `container-image-scan` after dependency or base image changes.
- Do not bypass failing scan checks without documented risk acceptance.
