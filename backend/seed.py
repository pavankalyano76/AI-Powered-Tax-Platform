"""
Populates the database with a believable firm's worth of fake data:
clients, the six demo user roles, returns in varied statuses, documents,
fields (including deliberately flagged low-confidence ones), tasks, and
messages. Run directly with `python seed.py` to (re)build the database
from scratch.
"""

import random
from collections import defaultdict
from datetime import date, timedelta

from flask import Flask

from models import db, Client, User, TaxReturn, Document, Field, Task, Message, StatusEvent
import ai_simulate

random.seed(7)

TODAY = date(2026, 7, 16)


def build_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tax_platform.db"
    db.init_app(app)
    return app


def seed():
    app = build_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        # ---- Clients ----
        sarah = Client(name="Sarah Chen", email="sarah.chen@example.com", entity_type="individual")
        webb = Client(name="Webb Consulting LLC", email="marcus@webbconsulting.example.com", entity_type="business")
        david = Client(name="David Nguyen", email="david.nguyen@example.com", entity_type="individual")
        lena = Client(name="Lena Ortiz", email="lena.ortiz@example.com", entity_type="individual")
        priya_personal = Client(name="Priya Patel", email="priya.patel@example.com", entity_type="individual")
        # genuinely brand-new — zero documents, zero fields — for Challenge 03 (first-time experience)
        jordan = Client(name="Jordan Lee", email="jordan.lee@example.com", entity_type="individual")
        db.session.add_all([sarah, webb, david, lena, priya_personal, jordan])
        db.session.flush()  # assigns .id to each

        # ---- Users (all six roles from Challenge 05) ----
        u_sarah = User(name="Sarah Chen", role="client", client_id=sarah.id)
        u_marcus = User(name="Marcus Webb", role="business_owner", client_id=webb.id)
        u_david = User(name="David Nguyen", role="client", client_id=david.id)
        u_lena = User(name="Lena Ortiz", role="client", client_id=lena.id)
        # Priya is firm staff AND has her own personal return — the dual-role edge case
        u_priya = User(name="Priya Patel", role="preparer", client_id=priya_personal.id)
        u_james = User(name="James O'Brien", role="reviewer")
        u_dana = User(name="Dana Fisher", role="admin")
        u_alex = User(name="Alex Kim", role="seasonal_staff")
        u_jordan = User(name="Jordan Lee", role="client", client_id=jordan.id)
        db.session.add_all([u_sarah, u_marcus, u_david, u_lena, u_priya, u_james, u_dana, u_alex, u_jordan])
        db.session.flush()

        # ---- Returns ----
        ret_sarah = TaxReturn(
            client_id=sarah.id, tax_year=2025, form_type="1040",
            status="gathering_docs", assigned_preparer_id=u_priya.id,
            due_date=TODAY + timedelta(days=45),
        )
        ret_webb = TaxReturn(
            client_id=webb.id, tax_year=2025, form_type="1120S",
            status="in_review", assigned_preparer_id=u_priya.id,
            due_date=TODAY + timedelta(days=20),
        )
        ret_priya = TaxReturn(
            client_id=priya_personal.id, tax_year=2025, form_type="1040",
            status="blocked", blocking_reason="Missing signed Form 8879",
            assigned_preparer_id=u_james.id,
            due_date=TODAY + timedelta(days=10),
        )
        ret_david = TaxReturn(
            client_id=david.id, tax_year=2025, form_type="1040",
            status="filed", assigned_preparer_id=u_priya.id,
            due_date=TODAY - timedelta(days=5),
        )
        ret_lena = TaxReturn(
            client_id=lena.id, tax_year=2025, form_type="1040",
            status="client_review", assigned_preparer_id=u_james.id,
            due_date=TODAY + timedelta(days=7),
        )
        ret_jordan = TaxReturn(
            client_id=jordan.id, tax_year=2025, form_type="1040",
            status="gathering_docs", assigned_preparer_id=u_alex.id,
            due_date=TODAY + timedelta(days=60),
        )
        db.session.add_all([ret_sarah, ret_webb, ret_priya, ret_david, ret_lena, ret_jordan])
        db.session.flush()

        # ---- Documents + Fields for Sarah Chen (the hand-authored "hero" return) ----
        doc_w2 = Document(return_id=ret_sarah.id, name="W-2 — Acme Corp", doc_type="W-2", page_count=1)
        doc_1098 = Document(return_id=ret_sarah.id, name="1098 — Mortgage Interest", doc_type="1098", page_count=1)
        doc_receipt = Document(return_id=ret_sarah.id, name="Charitable Donation Receipt", doc_type="receipt", page_count=1)
        db.session.add_all([doc_w2, doc_1098, doc_receipt])
        db.session.flush()

        def add_field(return_id, label, category, value, doc=None, page=None, region=None,
                       transform=None, force_state=None, force_low=False):
            if force_low:
                state, confidence, _ = ai_simulate.force_low_confidence(label)
            else:
                state, confidence, _ = ai_simulate.generate_field_ai_data(
                    label=label, category=category,
                    has_source_doc=doc is not None, has_transform=transform is not None,
                    force_state=force_state,
                )
            field = Field(
                return_id=return_id, label=label, category=category, value=value,
                source_document_id=doc.id if doc else None, source_page=page,
                source_region=region, transform=transform, state=state, confidence=confidence,
            )
            db.session.add(field)
            return field

        add_field(ret_sarah.id, "Box 1 Wages", "Income", "84,200.00", doc_w2, 1, "12,30,40,8")
        add_field(ret_sarah.id, "Federal Tax Withheld", "Income", "11,300.00", doc_w2, 1, "12,42,40,8")
        add_field(ret_sarah.id, "Mortgage Interest Paid", "Deductions", "9,450.00", doc_1098, 1, "15,20,35,8")
        add_field(ret_sarah.id, "Charitable Donation Amount", "Deductions", "1,140.00",
                   doc_receipt, 1, "20,50,30,10", force_low=True)
        add_field(ret_sarah.id, "Standard Deduction", "Deductions", "14,600.00", force_state="locked")
        add_field(ret_sarah.id, "Total Income", "Income", "84,200.00", doc_w2, 1, "12,54,40,8",
                   transform="Box 1 Wages + Box 1a Interest Income = Total Income")
        add_field(ret_sarah.id, "Filing Status", "General", "Single", force_state="editable")

        # ---- Documents + Fields for David Nguyen (filed — everything locked/final) ----
        doc_david_w2 = Document(return_id=ret_david.id, name="W-2 — TechCorp Solutions", doc_type="W-2", page_count=1)
        doc_david_div = Document(
            return_id=ret_david.id, name="1099-DIV — Vanguard Investments", doc_type="1099-DIV", page_count=1
        )
        db.session.add_all([doc_david_w2, doc_david_div])
        db.session.flush()

        add_field(ret_david.id, "Box 1 Wages", "Income", "91,400.00", doc_david_w2, 1, "12,30,40,8",
                   force_state="locked")
        add_field(ret_david.id, "Federal Tax Withheld", "Income", "13,150.00", doc_david_w2, 1, "12,42,40,8",
                   force_state="locked")
        add_field(ret_david.id, "Ordinary Dividends", "Income", "2,340.00", doc_david_div, 1, "15,25,35,8",
                   force_state="locked")
        add_field(ret_david.id, "Total Income", "Income", "93,740.00", doc_david_w2, 1, "12,54,40,8",
                   transform="Box 1 Wages + Ordinary Dividends = Total Income", force_state="locked")
        add_field(ret_david.id, "Filing Status", "General", "Married Filing Jointly", force_state="editable")

        # ---- Documents + Fields for Lena Ortiz (client review — ready, awaiting her sign-off) ----
        doc_lena_w2 = Document(return_id=ret_lena.id, name="W-2 — Bright Horizons Media", doc_type="W-2", page_count=1)
        doc_lena_int = Document(return_id=ret_lena.id, name="1099-INT — Ally Bank", doc_type="1099-INT", page_count=1)
        db.session.add_all([doc_lena_w2, doc_lena_int])
        db.session.flush()

        add_field(ret_lena.id, "Box 1 Wages", "Income", "67,900.00", doc_lena_w2, 1, "12,30,40,8")
        add_field(ret_lena.id, "Federal Tax Withheld", "Income", "8,760.00", doc_lena_w2, 1, "12,42,40,8")
        add_field(ret_lena.id, "Interest Income", "Income", "310.00", doc_lena_int, 1, "15,25,35,8")
        add_field(ret_lena.id, "Total Income", "Income", "68,210.00", doc_lena_w2, 1, "12,54,40,8",
                   transform="Box 1 Wages + Interest Income = Total Income")
        add_field(ret_lena.id, "Filing Status", "General", "Single", force_state="editable")

        # ---- Documents + Fields for Priya Patel's personal return (blocked on signature) ----
        doc_priya_w2 = Document(return_id=ret_priya.id, name="W-2 — GreenGrowth CPAs", doc_type="W-2", page_count=1)
        db.session.add(doc_priya_w2)
        db.session.flush()

        add_field(ret_priya.id, "Box 1 Wages", "Income", "78,500.00", doc_priya_w2, 1, "12,30,40,8")
        add_field(ret_priya.id, "Federal Tax Withheld", "Income", "10,220.00", doc_priya_w2, 1, "12,42,40,8")
        add_field(ret_priya.id, "Standard Deduction", "Deductions", "14,600.00", force_state="locked")
        add_field(ret_priya.id, "Total Income", "Income", "78,500.00", doc_priya_w2, 1, "12,54,40,8")
        add_field(ret_priya.id, "Filing Status", "General", "Single", force_state="editable")

        # ---- Hero documents for Webb Consulting (so specific tasks can deep-link
        # to a real field, not just the return in general — Challenge 04) ----
        doc_webb_bank = Document(
            return_id=ret_webb.id, name="Bank Statement — Chase Business Banking, November 2025",
            doc_type="Bank Statement", page_count=2,
        )
        doc_webb_payroll = Document(
            return_id=ret_webb.id, name="Payroll Report — Q4 2025", doc_type="Payroll Report", page_count=1,
        )
        db.session.add_all([doc_webb_bank, doc_webb_payroll])
        db.session.flush()

        add_field(ret_webb.id, "Ending Balance — November", "Expenses", "84,210.00",
                   doc_webb_bank, 1, "12,20,40,8")
        add_field(ret_webb.id, "Total Deposits — November", "Income", "42,600.00",
                   doc_webb_bank, 1, "12,32,40,8")
        add_field(ret_webb.id, "Q4 Payroll Total", "Payroll", "31,450.00",
                   doc_webb_payroll, 1, "12,20,42,8")

        # ---- Bulk documents + fields for Webb Consulting (volume for Challenge 09) ----
        # Real-sounding line items and vendors instead of "Category Line Item N" —
        # generic placeholders undermine the "quality, understandable data"
        # bar the rest of the app is held to, even at 150-field scale.
        doc_types = ["Invoice", "Receipt", "Bank Statement", "1099-NEC", "Payroll Report"]
        vendors = [
            "Acme Partners", "Contoso LLC", "Meridian Insurance", "Northwind Traders",
            "Skyline Properties", "Swift Logistics", "CloudStack Inc", "Horizon Payroll Services",
            "BrightPath Legal Group", "Apex Office Supply",
        ]
        banks = ["Chase Business Banking", "Wells Fargo Business", "First Republic Business"]
        months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        def doc_name(doc_type):
            if doc_type == "Bank Statement":
                return f"Bank Statement — {random.choice(banks)}, {random.choice(months)} 2025"
            if doc_type == "Payroll Report":
                return f"Payroll Report — {random.choice(months)} 2025"
            return f"{doc_type} — {random.choice(vendors)}"

        # (label pool, low/high dollar range) per category — ranges roughly
        # reflect real magnitude (payroll dwarfs office supplies, etc.)
        CATEGORY_ITEMS = {
            "Income": ([
                "Consulting Revenue — Acme Partners", "Consulting Revenue — Contoso LLC",
                "Consulting Revenue — Swift Logistics", "Consulting Revenue — CloudStack Inc",
                "Retainer Fee — Q1", "Retainer Fee — Q2", "Retainer Fee — Q3", "Retainer Fee — Q4",
                "Project Fee — Meridian Insurance", "Project Fee — Northwind Traders",
                "Project Fee — Skyline Properties", "Interest Income — Business Savings",
                "Referral Fee Income", "Workshop & Training Revenue", "Licensing Fee — Software Product",
            ], (1500, 45000)),
            "Expenses": ([
                "Office Rent — Downtown HQ", "Software Subscriptions — SaaS Tools",
                "Travel — Client Site Visit", "Contractor Payments — Design",
                "Contractor Payments — Development", "Utilities — Office", "Internet & Phone Service",
                "Office Supplies", "Marketing — Digital Ads", "Marketing — Trade Show Booth",
                "Professional Development — Conference", "Legal Fees — Contract Review",
                "Accounting & Bookkeeping Fees", "Client Entertainment", "Shipping & Postage",
                "Bank & Merchant Processing Fees",
            ], (120, 6500)),
            "Payroll": ([
                "Salary — Engineering Team", "Salary — Sales Team", "Salary — Operations Staff",
                "Payroll Tax — Q1", "Payroll Tax — Q2", "Payroll Tax — Q3", "Payroll Tax — Q4",
                "Health Insurance Premiums", "401(k) Employer Match", "Workers' Compensation Insurance",
                "Employee Bonus — Year End", "Contractor Payroll — 1099 Staff", "Payroll Processing Fees",
            ], (3000, 38000)),
            "Assets": ([
                "Office Equipment", "Company Vehicle — Ford Transit", "Laptops (4)", "Office Furniture",
                "Server Hardware", "Point-of-Sale System", "Security Camera System",
                "Conference Room AV Equipment", "Warehouse Shelving", "Company Vehicle — Toyota Camry",
            ], (600, 22000)),
            "Deductions": ([
                "Section 179 — Equipment", "Home Office Deduction", "Business Insurance Premium",
                "Depreciation — Vehicles", "Depreciation — Office Equipment",
                "Charitable Contribution — Business", "Bad Debt Expense", "Startup Cost Amortization",
                "Business Use of Personal Vehicle", "Retirement Plan Contribution — Employer",
            ], (250, 12000)),
        }
        categories = list(CATEGORY_ITEMS.keys())

        webb_docs = []
        for _ in range(1, 46):
            chosen_type = random.choice(doc_types)
            doc = Document(
                return_id=ret_webb.id,
                name=doc_name(chosen_type),
                doc_type=chosen_type,
                page_count=random.randint(1, 3),
            )
            db.session.add(doc)
            webb_docs.append(doc)
        db.session.flush()

        # Realistic mix of every affordance state, not just uniform high-
        # confidence AI output — otherwise Webb Consulting's ~150 fields
        # can't demonstrate locked/verified/editable/needs-approval on
        # their own, and a reviewer only ever sees one state in that return.
        doc_field_counts = defaultdict(int)
        for _ in range(1, 151):
            doc = random.choice(webb_docs)
            has_transform = random.random() < 0.3
            category = random.choice(categories)
            items, (lo, hi) = CATEGORY_ITEMS[category]
            label = random.choice(items)

            roll = random.random()
            if roll < 0.06:
                # already reviewed and finalized — no longer AI-controlled
                state, confidence, _ = ai_simulate.generate_field_ai_data(
                    label=label, category=category, has_source_doc=True,
                    has_transform=has_transform, force_state="locked",
                )
            elif roll < 0.10:
                # a human signed off — no confidence score needed
                state, confidence, _ = ai_simulate.generate_field_ai_data(
                    label=label, category=category, has_source_doc=True,
                    has_transform=has_transform, force_state="verified",
                )
            elif roll < 0.15:
                # manually entered adjustment — no source document at all
                state, confidence, _ = ai_simulate.generate_field_ai_data(
                    label=label, category=category, has_source_doc=False, has_transform=has_transform,
                )
            elif roll < 0.22:
                # deliberately low confidence — needs approval
                state, confidence, _ = ai_simulate.force_low_confidence(label)
            else:
                # the common case — normal AI extraction, high confidence
                state, confidence, _ = ai_simulate.generate_field_ai_data(
                    label=label, category=category, has_source_doc=True, has_transform=has_transform,
                )

            field_kwargs = dict(
                return_id=ret_webb.id, label=label, category=category,
                value=f"{random.randint(lo, hi):,}.00",
                transform="Sum of related line items" if has_transform else None,
                state=state, confidence=confidence,
            )

            if state == "editable":
                # nothing to point at on a document — matches how editable
                # fields work everywhere else in the app (e.g. Filing Status)
                field_kwargs.update(source_document_id=None, source_page=None, source_region=None)
            else:
                # lay fields out in a 2-column grid per document so multiple
                # fields on the same doc don't render on top of each other
                slot = doc_field_counts[doc.id]
                doc_field_counts[doc.id] += 1
                row, col = slot % 8, (slot // 8) % 2
                region = f"{8 + col * 48},{10 + row * 11},42,8"
                field_kwargs.update(source_document_id=doc.id, source_page=1, source_region=region)

            db.session.add(Field(**field_kwargs))
        db.session.flush()

        # ---- Tasks ----
        t1 = Task(return_id=ret_sarah.id, title="Upload missing 1099-INT", owner_role="client",
                   owner_user_id=u_sarah.id, status="open", priority="high",
                   due_date=TODAY + timedelta(days=3))
        t2 = Task(return_id=ret_sarah.id, title="Confirm filing status", owner_role="client",
                   owner_user_id=u_sarah.id, status="open", priority="medium",
                   due_date=TODAY + timedelta(days=5))
        t3 = Task(return_id=ret_sarah.id, title="Get clearer photo of donation receipt", owner_role="client",
                   owner_user_id=u_sarah.id, status="open", priority="high",
                   due_date=TODAY + timedelta(days=2), related_document_id=doc_receipt.id)
        t4 = Task(return_id=ret_webb.id, title="Review Q4 payroll figures", owner_role="preparer",
                   owner_user_id=u_priya.id, status="in_progress", priority="urgent",
                   due_date=TODAY + timedelta(days=1), related_document_id=doc_webb_payroll.id)
        t5 = Task(return_id=ret_webb.id, title="Reconcile November bank statement", owner_role="preparer",
                   owner_user_id=u_priya.id, status="open", priority="medium",
                   due_date=TODAY + timedelta(days=6), related_document_id=doc_webb_bank.id)
        t6 = Task(return_id=ret_priya.id, title="Obtain signed Form 8879", owner_role="client",
                   owner_user_id=u_priya.id, status="blocked", priority="urgent",
                   due_date=TODAY + timedelta(days=2))
        t7 = Task(return_id=ret_david.id, title="Archive filed return", owner_role="admin",
                   owner_user_id=u_dana.id, status="done", priority="low")
        t8 = Task(return_id=ret_lena.id, title="Client to review and e-sign", owner_role="client",
                   owner_user_id=u_lena.id, status="open", priority="high",
                   due_date=TODAY + timedelta(days=2))
        t9 = Task(return_id=ret_jordan.id, title="Upload your W-2", owner_role="client",
                   owner_user_id=u_jordan.id, status="open", priority="high",
                   due_date=TODAY + timedelta(days=10))
        t10 = Task(return_id=ret_jordan.id, title="Complete your tax questionnaire", owner_role="client",
                    owner_user_id=u_jordan.id, status="open", priority="medium",
                    due_date=TODAY + timedelta(days=10))
        t11 = Task(return_id=ret_jordan.id, title="Sign the engagement letter", owner_role="client",
                    owner_user_id=u_jordan.id, status="open", priority="high",
                    due_date=TODAY + timedelta(days=5))
        # give the reviewer and seasonal-staff roles real owned work too, so
        # their dashboards show a populated view, not just an empty state
        t12 = Task(return_id=ret_webb.id, title="Final review of Webb Consulting return", owner_role="reviewer",
                    owner_user_id=u_james.id, status="open", priority="high",
                    due_date=TODAY + timedelta(days=4))
        t13 = Task(return_id=ret_webb.id, title="Data-entry pass on receipt backlog", owner_role="seasonal_staff",
                    owner_user_id=u_alex.id, status="open", priority="medium",
                    due_date=TODAY + timedelta(days=3))
        db.session.add_all([t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11, t12, t13])
        db.session.flush()

        # ---- Messages (internal vs. client-visible, tied to documents/tasks) ----
        m1 = Message(return_id=ret_sarah.id, thread_id="thread-1", related_document_id=doc_receipt.id,
                      related_task_id=t3.id, author_user_id=u_priya.id, visibility="internal",
                      body="Confidence is low on this receipt — ask Sarah for a clearer photo before we file.",
                      )
        m2 = Message(return_id=ret_sarah.id, thread_id="thread-1", related_document_id=doc_receipt.id,
                      related_task_id=t3.id, author_user_id=u_priya.id, visibility="client",
                      body="Hi Sarah, could you resend a clearer photo of your donation receipt? The current scan is hard to read.",
                      )
        m3 = Message(return_id=ret_webb.id, thread_id="thread-2", related_task_id=t4.id,
                      author_user_id=u_priya.id, visibility="internal",
                      body="James, can you double check the payroll totals before I finalize Q4?",
                      )
        m4 = Message(return_id=ret_webb.id, thread_id="thread-2", related_task_id=t4.id,
                      author_user_id=u_james.id, visibility="internal",
                      body="Looked at it, numbers reconcile. Good to proceed.",
                      )
        m5 = Message(return_id=ret_priya.id, thread_id="thread-3", related_task_id=t6.id,
                      author_user_id=u_james.id, visibility="client",
                      body="Priya, your return is ready to file as soon as we have your signed 8879 on record.",
                      )

        # Webb Consulting — a client-visible thread with Marcus (the business
        # owner never had one before), plus Alex's internal update on his task
        m6 = Message(return_id=ret_webb.id, thread_id="thread-4", author_user_id=u_priya.id, visibility="client",
                      body="Hi Marcus, we've finished reviewing your Q4 numbers — everything looks solid. "
                           "We'll have the return ready for your review by early next week.")
        m7 = Message(return_id=ret_webb.id, thread_id="thread-4", author_user_id=u_marcus.id, visibility="client",
                      body="Sounds great, thanks for the update! Let me know if you need anything else from my end.")
        m8 = Message(return_id=ret_webb.id, thread_id="thread-5", related_task_id=t13.id,
                      author_user_id=u_alex.id, visibility="internal",
                      body="Finished entering the March receipts, moving on to April next.")

        # David Nguyen — a closing thread now that his return is filed
        m9 = Message(return_id=ret_david.id, thread_id="thread-6", author_user_id=u_priya.id, visibility="client",
                      body="Hi David, just confirming your 2025 return has been filed successfully. "
                           "Let us know if anything changes on your end.")
        m10 = Message(return_id=ret_david.id, thread_id="thread-6", author_user_id=u_david.id, visibility="client",
                       body="Thanks so much for the quick turnaround this year!")

        # Lena Ortiz — client-visible nudge to e-sign, plus an internal note about her response pattern
        m11 = Message(return_id=ret_lena.id, thread_id="thread-7", related_task_id=t8.id,
                       author_user_id=u_priya.id, visibility="client",
                       body="Hi Lena, your return is ready for your review and e-signature whenever you get a chance.")
        m12 = Message(return_id=ret_lena.id, thread_id="thread-7", related_task_id=t8.id,
                       author_user_id=u_priya.id, visibility="internal",
                       body="Lena usually takes a few days to respond — flag for a follow-up if we don't hear "
                            "back by Friday.")

        # Jordan Lee — welcome message from Alex, her assigned preparer
        m13 = Message(return_id=ret_jordan.id, thread_id="thread-8", author_user_id=u_alex.id, visibility="client",
                       body="Welcome to GreenGrowth! To get started, please upload your W-2 and complete the "
                            "tax questionnaire whenever you're ready.")

        # Priya's personal return — admin (Dana) weighing in, not just the reviewer
        m14 = Message(return_id=ret_priya.id, thread_id="thread-9", related_task_id=t6.id,
                       author_user_id=u_dana.id, visibility="internal",
                       body="Let's make sure we get Priya's signature before the deadline — this one's overdue.")

        # A second, unrelated thread on Sarah's return — proves the multi-thread
        # pattern isn't special-cased for Webb, it's just however many topics
        # a return actually has going on. Tied to her other open task
        # ("Confirm filing status"), which didn't have a conversation yet.
        m15 = Message(return_id=ret_sarah.id, thread_id="thread-10", related_task_id=t2.id,
                       author_user_id=u_priya.id, visibility="client",
                       body="Hi Sarah, quick one — are you filing as Single, or is there a change in marital "
                            "status to report this year?")
        m16 = Message(return_id=ret_sarah.id, thread_id="thread-10", related_task_id=t2.id,
                       author_user_id=u_sarah.id, visibility="client",
                       body="Still single! No changes from last year.")

        db.session.add_all([m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16])

        # ---- Status history (Challenge 06 — "what's already happened") ----
        # Fabricated but plausible timelines, distinct per return so the
        # history reads as real progress, not a copy-pasted template.
        history_events = [
            (ret_sarah, "Return created", TODAY - timedelta(days=20)),
            (ret_sarah, "Document checklist sent to client", TODAY - timedelta(days=18)),
            (ret_sarah, "W-2 uploaded", TODAY - timedelta(days=10)),
            (ret_sarah, "1098 uploaded", TODAY - timedelta(days=8)),
            (ret_sarah, "Charitable donation receipt uploaded", TODAY - timedelta(days=6)),

            (ret_webb, "Return created", TODAY - timedelta(days=35)),
            (ret_webb, "Document collection completed", TODAY - timedelta(days=20)),
            (ret_webb, "Preparation started", TODAY - timedelta(days=15)),
            (ret_webb, "Sent for internal review", TODAY - timedelta(days=3)),

            (ret_priya, "Return created", TODAY - timedelta(days=25)),
            (ret_priya, "Documents collected", TODAY - timedelta(days=15)),
            (ret_priya, "Preparation completed", TODAY - timedelta(days=8)),
            (ret_priya, "Blocked — awaiting signed Form 8879", TODAY - timedelta(days=5)),

            (ret_david, "Return created", TODAY - timedelta(days=60)),
            (ret_david, "Documents collected", TODAY - timedelta(days=45)),
            (ret_david, "Prepared and reviewed", TODAY - timedelta(days=30)),
            (ret_david, "Client approved and signed", TODAY - timedelta(days=15)),
            (ret_david, "E-filed with the IRS", TODAY - timedelta(days=10)),

            (ret_lena, "Return created", TODAY - timedelta(days=22)),
            (ret_lena, "Documents collected", TODAY - timedelta(days=14)),
            (ret_lena, "Prepared and reviewed internally", TODAY - timedelta(days=6)),
            (ret_lena, "Sent to client for review and signature", TODAY - timedelta(days=2)),

            (ret_jordan, "Return created", TODAY - timedelta(days=1)),
        ]
        for tax_return, label, occurred_at in history_events:
            db.session.add(StatusEvent(return_id=tax_return.id, label=label, occurred_at=occurred_at))

        db.session.commit()
        print(f"Seeded database: {Client.query.count()} clients, {User.query.count()} users, "
              f"{TaxReturn.query.count()} returns, {Document.query.count()} documents, "
              f"{Field.query.count()} fields, {Task.query.count()} tasks, "
              f"{Message.query.count()} messages, {StatusEvent.query.count()} status events.")


if __name__ == "__main__":
    seed()
