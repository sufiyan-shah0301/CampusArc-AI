import io

import pdfplumber
from fastapi import HTTPException

MAX_BYTES = 5 * 1024 * 1024
MAX_CHARS = 12000


def extract_text(filename: str, data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is too large (max 5 MB).")
    name = (filename or "").lower()
    if data[:5] == b"%PDF-":
        try:
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                text = "\n".join((p.extract_text() or "") for p in pdf.pages[:8])
        except Exception:
            raise HTTPException(422, "Could not read this PDF. Is it corrupted or password-protected?")
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(415, "Please upload a PDF or .txt resume.")
    text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if len(text) < 80:
        raise HTTPException(422, "No readable text found. Scanned/image-only PDFs are not supported yet.")
    return text[:MAX_CHARS]
