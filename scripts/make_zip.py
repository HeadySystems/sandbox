from __future__ import annotations

import argparse
from pathlib import Path
import zipfile

DEFAULT_EXCLUDE_PARTS = {
    'node_modules',
    '.git',
    '__pycache__',
    '.next',
    '.turbo',
    '.pytest_cache',
    '.venv',
    'dist',
}
DEFAULT_EXCLUDE_SUFFIXES = {'.pyc', '.pyo'}


def should_exclude(path: Path, root: Path, exclude_parts: set[str], exclude_suffixes: set[str]) -> bool:
    rel = path.relative_to(root)
    if any(part in exclude_parts for part in rel.parts):
        return True
    if path.suffix in exclude_suffixes:
        return True
    return False


def build_zip(root: Path, output: Path, prefix: str) -> tuple[int, int]:
    files_written = 0
    bytes_written = 0

    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob('*')):
            if path.is_dir():
                continue
            if path.is_symlink() or not path.exists():
                continue
            if should_exclude(path, root, DEFAULT_EXCLUDE_PARTS, DEFAULT_EXCLUDE_SUFFIXES):
                continue

            rel = path.relative_to(root)
            arcname = str(Path(prefix) / rel)
            try:
                file_size = path.stat().st_size
                zf.write(path, arcname=arcname)
            except FileNotFoundError:
                continue

            files_written += 1
            bytes_written += file_size

    return files_written, bytes_written


def main() -> None:
    parser = argparse.ArgumentParser(description='Create a clean project zip bundle.')
    parser.add_argument(
        '--output',
        default='dist/heady-pre-production-sacred-genesis.zip',
        help='Relative or absolute output path for the zip bundle.',
    )
    parser.add_argument(
        '--prefix',
        default='heady-pre-production-sacred-genesis',
        help='Top-level folder name used inside the zip archive.',
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    output = Path(args.output)
    if not output.is_absolute():
        output = root / output

    files_written, bytes_written = build_zip(root, output, args.prefix)
    print(
        f'Created zip: {output}\n'
        f'Files: {files_written}\n'
        f'Raw size: {bytes_written} bytes'
    )


if __name__ == '__main__':
    main()
