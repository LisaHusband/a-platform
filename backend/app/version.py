"""Application version metadata.

The deploy pipeline writes the released version into the APLATFORM_VERSION
environment variable (typically the release id / git short SHA), surfaced by
`/api/v1/version` so operators and health checks can confirm what is live.
"""

import os

APP_NAME = "A-PLATFORM"
APP_VERSION = os.environ.get("APLATFORM_VERSION", "0.3.0-alpha")
