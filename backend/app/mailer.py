"""E-mail delivery over SMTP (optional). Without SMTP_HOST configured, messages are only logged (development)."""
import asyncio
import smtplib
from email.message import EmailMessage

from .config import get_settings


def send_sync(to: str, subject: str, body: str) -> bool:
    s = get_settings()
    if not s.smtp_host:
        print(f"[DEV e-mail] to={to} subject={subject!r}\n{body}\n")
        return False
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, s.smtp_from or s.smtp_user, to
    msg.set_content(body)
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
        if s.smtp_user:
            smtp.starttls()
            smtp.login(s.smtp_user, s.smtp_password)
        smtp.send_message(msg)
    return True


async def send(to: str, subject: str, body: str) -> bool:
    """Never raises: a mail problem must not break the request that triggered it."""
    try:
        return await asyncio.to_thread(send_sync, to, subject, body)
    except Exception as e:
        print(f"[mail] delivery to {to} failed: {type(e).__name__}: {e}")
        return False
