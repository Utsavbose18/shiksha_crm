import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


from email.mime.base import MIMEBase
from email import encoders


def send_email(to_email: str, subject: str, body: str,
               attachment_data: bytes = None,
               attachment_name: str = None,
               attachment_type: str = None):
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email
        msg["Subject"] = subject

        # Body
        msg.attach(MIMEText(body, "plain"))

        # Attachment
        if attachment_data and attachment_name:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_data)
            encoders.encode_base64(part)

            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{attachment_name}"'
            )

            msg.attach(part)

        # SMTP
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()

    except Exception as e:
        raise Exception(f"Email failed: {str(e)}")
