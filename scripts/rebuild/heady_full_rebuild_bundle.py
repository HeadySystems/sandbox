#!/usr/bin/env python3
"""DEPRECATED — use scripts/rebuild_sacred_genesis.py instead.

This shim exists for backward compatibility. It delegates to the
consolidated rebuild_sacred_genesis.py which combines naming audit +
zip bundle generation.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONSOLIDATED = ROOT / 'scripts' / 'rebuild_sacred_genesis.py'


def main() -> None:
    print(f'[DEPRECATED] Delegating to {CONSOLIDATED.relative_to(ROOT)}')
    result = subprocess.run(
        [sys.executable, str(CONSOLIDATED)],
        cwd=ROOT,
    )
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
