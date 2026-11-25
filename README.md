# Invexa AI

**Intelligent invoice verification & approval.**

> Read intelligently. Validate deterministically. Approve responsibly.

Invexa AI reads invoices (PDF, PNG, JPEG), extracts the key fields with AI, then verifies the numbers with plain, deterministic code. Every invoice ends up either **eligible for approval** or **routed to a human with a reason**. Invexa never silently approves.

---

## Table of Contents

- [Why Invexa](#why-invexa)
- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Validation Rules](#validation-rules)
- [Testing](#testing)
- [Demo](#demo)
- [Security & Human Control](#security--human-control)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why Invexa

Manual invoice review is slow and error-prone:

- **Manual review drag:** data entry and arithmetic checks eat repetitive effort.
- **Hidden exceptions:** missing fields, mismatched totals, duplicates, and unreadable scans are easy to miss.
- **Black-box risk:** a green or red score does not explain what failed or what to do next.

Generic OCR stops at extracted text. Invexa adds rule-based checks and an evidence trail behind every approve or review decision.

> **Use AI for ambiguity. Use code for financial authority. Keep humans in the loop when it counts.**

## Features

- Upload PDF, PNG, or JPEG invoices with safe file checks
- Structured extraction of vendor, dates, currency, line items, subtotal, tax, and total
- Deterministic recomputation of money values (line math, subtotal, tax, total)
- Explicit business rules with rule IDs and readable failure reasons
- Unknown fields stay `null`; ambiguity goes to review instead of a guess
- Human review queue for uncertain, incomplete, duplicate, or policy-sensitive invoices
- Evidence trail behind every decision

## How It Works

```
Upload  ->  Understand  ->  Verify  ->  Route
```

| Stage | What happens |
|-------|--------------|
| **Upload** | Accept PDF, PNG, or JPEG invoices after content-type, size, and signature checks. |
| **Understand** | Gemini extracts vendor, dates, currency, line items, subtotal, tax, and total into a structured object. |
| **Verify** | Python recomputes money values and applies explicit business rules. |
| **Route** | The invoice is marked eligible for approval, or sent to human review with a reason. |

The review queue closes the loop when evidence is incomplete or policy-sensitive.

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Experience | React + Vite (dashboard, upload, preview, review queue) |
| Services | Python, FastAPI (file handling, orchestration) |
| Intelligence | Gemini API (structured extraction), Pydantic (schema validation) |
| Trust layer | Python `Decimal`, PostgreSQL, pytest, Git / GitHub |

## Project Structure

> Adjust this to match your repository.

```
invexa-ai/
├── frontend/            # React + Vite app
│   ├── src/
│   └── package.json
├── backend/             # FastAPI service
│   ├── app/
│   │   ├── main.py
│   │   ├── extraction/  # Gemini extraction + Pydantic schemas
│   │   ├── validation/  # Deterministic checks and rule engine
│   │   └── review/      # Review queue and decisions
│   ├── tests/
│   └── requirements.txt
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- A Gemini API key

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd invexa-ai
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000` (interactive docs at `/docs`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Configuration

Create a `.env` file in `backend/` (never commit it):

```env
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql://user:password@localhost:5432/invexa
MAX_UPLOAD_MB=10
AMOUNT_TOLERANCE=0.01
```

Keys stay server-side. The frontend never sees the Gemini key.

## Validation Rules

Explicit checks turn extracted values into visible evidence:

- **Line math:** quantity x unit price, discounts, rounding, and subtotal reconciliation
- **Total math:** subtotal + tax compared with the document total within a stated tolerance
- **Completeness:** vendor name, invoice number, date, currency, and required fields present
- **Uncertainty:** unreadable or ambiguous extraction never becomes a plausible guess

Each failed check returns a rule ID and a human-readable reason.

## Testing

```bash
cd backend
pytest
```

Tests cover the arithmetic and rule engine using synthetic invoices, including deliberately incorrect totals.

## Demo

1. **Clean invoice:** totals reconcile, checks pass, invoice is eligible for approval.
2. **Incorrect invoice:** a mismatched total is flagged and routed to human review with its reason.

## Security & Human Control

Valid is not the same as approved. Arithmetic is not proof of legitimacy.

- **AI uncertainty:** unknown stays unknown; return `null` and route ambiguity to review.
- **Untrusted files:** check content type, size, and signatures; use safe storage, rate limits, and malware controls.
- **Privacy:** keep keys server-side, minimize logging, restrict access, define retention rules.
- **Decision boundary:** financial checks support a decision; they do not silently make one.

## Roadmap

- End-to-end flow first: upload -> extraction -> validation -> review
- Analytics and reporting
- Advanced access control and audit views

## License

Add a license here (for example, MIT).
