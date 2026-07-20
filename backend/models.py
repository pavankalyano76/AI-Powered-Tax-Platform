from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120))
    entity_type = db.Column(db.String(50))  # "individual" or "business"


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    # role is one of: client, business_owner, preparer, reviewer, admin, seasonal_staff
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=True)
    # ^ set when this user IS a client (or a staffer who also has a personal return)


class TaxReturn(db.Model):
    __tablename__ = "returns"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    tax_year = db.Column(db.Integer, nullable=False)
    form_type = db.Column(db.String(20))  # "1040", "1120S", etc.
    status = db.Column(db.String(50))
    # status is one of: gathering_docs, in_preparation, in_review, client_review, blocked, filed
    blocking_reason = db.Column(db.String(255))
    assigned_preparer_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    due_date = db.Column(db.Date)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship("Client", backref="returns")
    preparer = db.relationship("User", foreign_keys=[assigned_preparer_id])


class Document(db.Model):
    __tablename__ = "documents"
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey("returns.id"), nullable=False)
    name = db.Column(db.String(150))
    doc_type = db.Column(db.String(50))  # "W-2", "1099-NEC", "1098", "receipt"...
    page_count = db.Column(db.Integer, default=1)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    tax_return = db.relationship("TaxReturn", backref="documents")


class Field(db.Model):
    __tablename__ = "fields"
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey("returns.id"), nullable=False)
    label = db.Column(db.String(150))
    category = db.Column(db.String(80))  # "Income", "Deductions", "Credits"...
    value = db.Column(db.String(120))

    source_document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=True)
    source_page = db.Column(db.Integer, nullable=True)
    source_region = db.Column(db.String(50))  # "x,y,w,h" as % of page, for the highlight box
    transform = db.Column(db.Text)  # human-readable description of any calc applied

    state = db.Column(db.String(30))  # ai_generated, verified, locked, editable
    confidence = db.Column(db.Float, nullable=True)  # 0.0-1.0, null if not AI-touched

    tax_return = db.relationship("TaxReturn", backref="fields")
    source_document = db.relationship("Document")


class Task(db.Model):
    __tablename__ = "tasks"
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey("returns.id"), nullable=False)
    title = db.Column(db.String(200))
    owner_role = db.Column(db.String(50))
    owner_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(30))  # open, in_progress, done, blocked
    priority = db.Column(db.String(20))  # low, medium, high, urgent
    due_date = db.Column(db.Date, nullable=True)
    related_document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=True)

    tax_return = db.relationship("TaxReturn", backref="tasks")


class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey("returns.id"), nullable=False)
    thread_id = db.Column(db.String(50))
    related_document_id = db.Column(db.Integer, db.ForeignKey("documents.id"), nullable=True)
    related_task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=True)
    author_user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    visibility = db.Column(db.String(20))  # "internal" or "client"
    body = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    tax_return = db.relationship("TaxReturn", backref="messages")


class StatusEvent(db.Model):
    """A dated entry in a return's history — 'what's already happened',
    the one piece the status stepper alone can't show."""
    __tablename__ = "status_events"
    id = db.Column(db.Integer, primary_key=True)
    return_id = db.Column(db.Integer, db.ForeignKey("returns.id"), nullable=False)
    label = db.Column(db.String(200), nullable=False)
    occurred_at = db.Column(db.Date, nullable=False)

    tax_return = db.relationship("TaxReturn", backref="status_events")
