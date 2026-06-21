"""本地文件存储 / local file storage for uploaded submissions.

生产可替换为 S3 兼容对象存储；此处用本地目录，路径由 APLATFORM_UPLOADS 覆盖。
Swappable for S3-compatible storage in production; here a local directory,
overridable via APLATFORM_UPLOADS.
"""

import os
import uuid
from pathlib import Path

_DEFAULT_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR = Path(os.environ.get("APLATFORM_UPLOADS", str(_DEFAULT_DIR)))

TEXT_EXTS = {".txt", ".md"}


def save_upload(filename: str, data: bytes) -> str:
    """保存文件并返回存储名 / persist bytes, return the stored file name."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(filename or "").suffix.lower()
    stored = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored).write_bytes(data)
    return stored


def read_text_if_supported(filename: str, data: bytes) -> str:
    """文本类文件抽取正文，其余返回空 / extract text for text-like files."""
    ext = Path(filename or "").suffix.lower()
    if ext in TEXT_EXTS:
        return data.decode("utf-8", errors="replace")
    return ""


def path_for(stored_name: str) -> Path:
    return UPLOAD_DIR / stored_name
