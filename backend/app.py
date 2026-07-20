"""
Flask API for the tax platform prototype.

In development, this runs on :5000 and the Vite dev server runs separately
on :5173 with a proxy forwarding /api requests here (CORS is enabled below
so that works even before the proxy is wired up). For submission, the
built frontend (frontend/dist) is served as static files from this same
process, so the whole prototype ships as one deployable app.
"""

import os
from datetime import date

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from models import db, Client, User, TaxReturn, Document, Field, Task, Message, StatusEvent
import ai_simulate

TODAY = date(2026, 7, 16)


def create_app():
    app = Flask(__name__, static_folder="../frontend/dist", static_url_path="/")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tax_platform.db"
    db.init_app(app)
    CORS(app)
    register_routes(app)
    return app


# ---------- Serializers ----------
# Plain explicit to_dict-style functions — only 7 shapes of object exist
# here, not worth pulling in a serialization library for that.

def serialize_user(u):
    return {"id": u.id, "name": u.name, "role": u.role, "client_id": u.client_id}


def serialize_client(c):
    return {"id": c.id, "name": c.name, "email": c.email, "entity_type": c.entity_type}


def serialize_return_summary(r):
    return {
        "id": r.id,
        "client": serialize_client(r.client),
        "tax_year": r.tax_year,
        "form_type": r.form_type,
        "status": r.status,
        "blocking_reason": r.blocking_reason,
        "preparer": serialize_user(r.preparer) if r.preparer else None,
        "due_date": r.due_date.isoformat() if r.due_date else None,
    }


def serialize_document(d):
    return {
        "id": d.id, "return_id": d.return_id, "name": d.name,
        "doc_type": d.doc_type, "page_count": d.page_count,
    }


def serialize_field(f):
    return {
        "id": f.id, "return_id": f.return_id, "label": f.label, "category": f.category,
        "value": f.value, "state": f.state, "confidence": f.confidence,
        "source_document_id": f.source_document_id, "source_page": f.source_page,
        "source_region": f.source_region, "transform": f.transform,
    }


def serialize_task(t):
    return {
        "id": t.id, "return_id": t.return_id, "title": t.title,
        "owner_role": t.owner_role, "owner_user_id": t.owner_user_id,
        "status": t.status, "priority": t.priority,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "related_document_id": t.related_document_id,
    }


def serialize_message(m):
    return {
        "id": m.id, "return_id": m.return_id, "thread_id": m.thread_id,
        "related_document_id": m.related_document_id, "related_task_id": m.related_task_id,
        "author": serialize_user(User.query.get(m.author_user_id)),
        "visibility": m.visibility, "body": m.body,
        "created_at": m.created_at.isoformat(),
    }


def serialize_status_event(e):
    return {"id": e.id, "return_id": e.return_id, "label": e.label, "occurred_at": e.occurred_at.isoformat()}


# ---------- Dashboard prioritization ----------
# Real scoring logic, not mocked, per the brief's instruction to build
# actual ranking behavior against the fake dataset.

_PRIORITY_WEIGHT = {"urgent": 4, "high": 3, "medium": 2, "low": 1}


def score_task(task):
    score = _PRIORITY_WEIGHT.get(task.priority, 1) * 25
    if task.due_date:
        days_left = (task.due_date - TODAY).days
        if days_left < 0:
            score += 50
        elif days_left <= 2:
            score += 30
        elif days_left <= 7:
            score += 15
    if task.status == "blocked":
        score += 40
    return score


# ---------- Routes ----------

def register_routes(app):

    @app.get("/api/users")
    def list_users():
        return jsonify([serialize_user(u) for u in User.query.all()])

    @app.get("/api/returns")
    def list_returns():
        """
        ?user_id=<id> scopes results the way a real login would: clients
        and business owners see only their own return; staff roles see
        what's assigned to them (plus their own personal return, if they
        have one — e.g. a preparer who is also a client); admin (no
        filter) sees everything.
        """
        user_id = request.args.get("user_id", type=int)
        query = TaxReturn.query
        if user_id:
            user = User.query.get(user_id)
            if user and user.role in ("client", "business_owner"):
                query = query.filter_by(client_id=user.client_id)
            elif user and user.role in ("preparer", "reviewer", "seasonal_staff"):
                conditions = [TaxReturn.assigned_preparer_id == user.id]
                if user.client_id:
                    conditions.append(TaxReturn.client_id == user.client_id)
                query = query.filter(db.or_(*conditions))
        returns = query.order_by(TaxReturn.due_date.asc()).all()
        result = []
        for r in returns:
            needs_attention = (
                Field.query.filter(
                    Field.return_id == r.id, Field.confidence.isnot(None), Field.confidence < 0.7
                ).first()
                is not None
            )
            result.append({**serialize_return_summary(r), "needs_attention": needs_attention})
        return jsonify(result)

    @app.get("/api/returns/<int:return_id>")
    def get_return(return_id):
        r = TaxReturn.query.get_or_404(return_id)
        history = StatusEvent.query.filter_by(return_id=return_id).order_by(StatusEvent.occurred_at.asc()).all()
        return jsonify({
            **serialize_return_summary(r),
            "documents": [serialize_document(d) for d in r.documents],
            "fields": [serialize_field(f) for f in r.fields],
            "tasks": [serialize_task(t) for t in r.tasks],
            "history": [serialize_status_event(e) for e in history],
        })

    @app.get("/api/returns/<int:return_id>/messages")
    def get_messages(return_id):
        msgs = Message.query.filter_by(return_id=return_id).order_by(Message.created_at.asc()).all()
        return jsonify([serialize_message(m) for m in msgs])

    @app.post("/api/returns/<int:return_id>/messages")
    def post_message(return_id):
        data = request.get_json(force=True)
        msg = Message(
            return_id=return_id,
            thread_id=data.get("thread_id", "thread-general"),
            related_document_id=data.get("related_document_id"),
            related_task_id=data.get("related_task_id"),
            author_user_id=data["author_user_id"],
            visibility=data.get("visibility", "client"),
            body=data["body"],
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify(serialize_message(msg)), 201

    @app.get("/api/documents/<int:document_id>")
    def get_document(document_id):
        d = Document.query.get_or_404(document_id)
        fields = Field.query.filter_by(source_document_id=document_id).all()
        return jsonify({**serialize_document(d), "fields": [serialize_field(f) for f in fields]})

    @app.get("/api/ai/explain/<int:field_id>")
    def explain_field(field_id):
        f = Field.query.get_or_404(field_id)
        return jsonify(ai_simulate.explain(f))

    @app.get("/api/ai/correction/<int:field_id>")
    def field_correction(field_id):
        f = Field.query.get_or_404(field_id)
        suggestion = ai_simulate.suggest_correction(f)
        return jsonify(suggestion or {})

    @app.patch("/api/fields/<int:field_id>")
    def update_field(field_id):
        """
        Applies a correction (or a plain 'mark reviewed'). Whatever the
        caller sends for `value`/`state` is trusted as-is — there's no
        real reviewer auth here, this is a prototype standing in for what
        would be a real edit/approve action.
        """
        f = Field.query.get_or_404(field_id)
        data = request.get_json(force=True)
        if "value" in data:
            f.value = data["value"]
        if "state" in data:
            f.state = data["state"]
        if "confidence" in data:
            f.confidence = data["confidence"]
        db.session.commit()
        return jsonify(serialize_field(f))

    @app.patch("/api/tasks/<int:task_id>")
    def update_task(task_id):
        """
        Marks a task done/reopens it (onboarding upload flow), snoozes its
        due date, or reassigns its owner (Dashboard inline actions).
        """
        t = Task.query.get_or_404(task_id)
        data = request.get_json(force=True)
        if "status" in data:
            t.status = data["status"]
        if "due_date" in data:
            t.due_date = date.fromisoformat(data["due_date"])
        if "owner_user_id" in data:
            t.owner_user_id = data["owner_user_id"]
        db.session.commit()
        return jsonify(serialize_task(t))

    @app.get("/api/dashboard")
    def dashboard():
        """
        ?user_id=<id> — ranked, filtered task list answering 'what should I
        work on right now'. Admins see every open task firm-wide (a manager
        view); other staff see only what's assigned to them.
        """
        user_id = request.args.get("user_id", type=int)
        user = User.query.get(user_id) if user_id else None
        query = Task.query.filter(Task.status != "done")
        if user and user.role != "admin":
            query = query.filter_by(owner_user_id=user_id)
        tasks = query.all()
        ranked = sorted(tasks, key=score_task, reverse=True)

        result = []
        for t in ranked:
            r = TaxReturn.query.get(t.return_id)
            owner = User.query.get(t.owner_user_id) if t.owner_user_id else None
            # if this task is tied to a document, resolve a real field on it
            # so the dashboard can deep-link straight to the exact field
            # instead of just dropping the user on the return in general
            related_field_id = None
            if t.related_document_id:
                field = Field.query.filter_by(source_document_id=t.related_document_id).first()
                related_field_id = field.id if field else None
            result.append({
                **serialize_task(t),
                "score": score_task(t),
                "client_name": r.client.name if r else None,
                "return_status": r.status if r else None,
                "owner_name": owner.name if owner else None,
                "related_field_id": related_field_id,
            })
        return jsonify(result)

    # ---------- Serve the built frontend (submission / production mode) ----------
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        dist_dir = app.static_folder
        if not dist_dir or not os.path.isdir(dist_dir):
            return jsonify({
                "message": "Frontend not built yet. Use the Vite dev server on :5173 during "
                           "development, or run `npm run build` in /frontend to enable this route."
            })
        full_path = os.path.join(dist_dir, path) if path else None
        if path and full_path and os.path.exists(full_path):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")


app = create_app()

if __name__ == "__main__":
    # Port 5000 collides with macOS AirPlay Receiver on many Macs, which
    # silently answers requests instead of Flask — 5050 avoids that entirely.
    # PORT is set by the hosting platform in production; debug is local-only.
    port = int(os.environ.get("PORT", 5050))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
