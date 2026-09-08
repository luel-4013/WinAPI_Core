# Security & Responsible Use

## What this project is

WINAPI//CORE is a **reference / research tool** that aggregates publicly published Windows API documentation, MITRE ATT&CK technique data, syscall tables, and malapi.io's attack categorization into a local, searchable dataset. It **does not** implement any exploit, injection, or persistence technique — it documents which Windows APIs are commonly associated with offensive categories and maps them to MITRE techniques.

## Dual-use warning

Many documented APIs are dual-use. Something being categorized as e.g. "Injection" or "Spying" means "this API is commonly observed in malware" — not that merely looking it up is malicious. The data is for:

- Defenders building detections and telemetry,
- Malware analysts triaging samples,
- Researchers correlating Windows API usage with techniques,

and **not** for attacking systems you do not own or do not have explicit authorization to test. You are responsible for complying with all applicable laws and authorization requirements in your jurisdiction.

## No secrets, no telemetry

- WINAPI//CORE makes **no outbound calls** except the explicit public data sources listed in the README (malapi.io, mitre/cti, j00ru/windows-syscalls, MicrosoftDocs/sdk-api, learn.microsoft.com).
- It runs locally with no analytics/beaconing. Cached content is stored under the git-ignored `data/` directory, which you may delete at any time.
- With `SYNC_OFFLINE=1` all network access is refused.

## Reporting a vulnerability

For security issues in this project, please do **not** open a public issue that includes exploit detail. Contact the maintainer privately:

- Open a GitHub Security Advisory via **Security → Report a vulnerability** on https://github.com/luel-4013/WINAPI_CORE
- Or open a labeled private issue referencing the security concern.

Please include: affected version, a minimal reproducer, and impact. Maintainers will acknowledge within 5 business days.

## Disclosure

This repository is provided "as is", without warranty of any kind, under the [MIT License](LICENSE). See the license for the full disclaimer.