"""Send email alerts when workflow completes, fails, or pauses."""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Any

from core.config import settings

logger = logging.getLogger(__name__)


def send_alert(event: str, execution_id: int, workflow_id: int, status: str, extra: dict[str, Any] | None = None) -> None:
    """Send an email if alert_email_to and SMTP are configured. No-op otherwise."""
    to_addr = getattr(settings, "alert_email_to", None) or ""
    if not to_addr or not to_addr.strip():
        return
    host = getattr(settings, "smtp_host", None) or ""
    if not host or not host.strip():
        logger.debug("SMTP not configured, skipping email alert")
        return

    subject = f"Workflow {status}: execution #{execution_id}"
    body_lines = [
        f"Event: {event}",
        f"Execution ID: {execution_id}",
        f"Workflow ID: {workflow_id}",
        f"Status: {status}",
    ]
    if extra:
        for k, v in extra.items():
            body_lines.append(f"{k}: {v}")
    body = "\n".join(body_lines)

    from_addr = getattr(settings, "smtp_from", None) or getattr(settings, "smtp_user", None) or "noreply@localhost"
    user = getattr(settings, "smtp_user", None) or ""
    password = getattr(settings, "smtp_password", None) or ""
    port = int(getattr(settings, "smtp_port", 587) or 587)

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            if user and password:
                server.login(user, password)
            server.sendmail(from_addr, to_addr.split(","), msg.as_string())
    except Exception as e:
        logger.warning("Email alert failed: %s", e)
