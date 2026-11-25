import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { extractInvoiceFields } from './server/aiExtractor.ts';
import {
  buildDemoSeed,
  deleteStoredFile,
  loadDb,
  resolveStoredFile,
  saveDb,
  saveUploadedFile,
} from './server/store.ts';
import { runDeterministicTestSuite, validateInvoiceData } from './server/validator.ts';
import type { InvoiceRecord, PolicyConfig } from './src/types/invoice.ts';

dotenv.config();

const PORT = 3000;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

function matchesFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Ensure initial DB exists
  loadDb();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Invexa AI' });
  });

  app.get('/api/invoices', (req, res) => {
    const db = loadDb();
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'ALL';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const filtered = db.invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (query) {
        const hay = `${inv.vendor_name ?? ''} ${inv.invoice_number ?? ''} ${inv.filename}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    res.json({ invoices: filtered, policy: db.policy });
  });

  app.get('/api/invoices/:id', (req, res) => {
    const db = loadDb();
    const record = db.invoices.find((i) => i.id === req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Invoice record not found.' });
    }
    return res.json({ invoice: record, policy: db.policy });
  });

  app.get('/api/invoices/:id/file', (req, res) => {
    const db = loadDb();
    const record = db.invoices.find((i) => i.id === req.params.id);
    if (!record || !record.has_file) {
      return res.status(404).json({ error: 'Source document file not found.' });
    }
    const resolved = resolveStoredFile(record.id, record.mime_type);
    if (!resolved) {
      return res.status(404).json({ error: 'Stored file unavailable.' });
    }
    res.setHeader('Content-Type', resolved.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    if (resolved.mimeType === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    }
    return fs.createReadStream(resolved.filePath).pipe(res);
  });

  app.post('/api/invoices/analyze', (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File exceeds the 10 MB size limit.' });
        }
        return res.status(400).json({ error: uploadErr.message || 'Invalid file upload.' });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Please select a PDF, PNG, or JPEG invoice file.' });
      }
      if (!ALLOWED_MIMES.has(file.mimetype)) {
        return res
          .status(400)
          .json({ error: 'Unsupported file type. Upload a PDF, PNG, or JPEG file.' });
      }
      if (!file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: 'The uploaded file is empty.' });
      }
      if (!matchesFileSignature(file.buffer, file.mimetype)) {
        return res.status(400).json({
          error: 'File contents do not match the declared PDF, PNG, or JPEG format.',
        });
      }

      const db = loadDb();
      const id = `inv-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const safeOriginalName = path.basename(file.originalname || `invoice-${id}`).slice(0, 120);

      try {
        const extracted = await extractInvoiceFields(file.buffer, file.mimetype);
        saveUploadedFile(id, file.mimetype, file.buffer);

        const validation = validateInvoiceData(
          { ...extracted, id },
          db.invoices,
          db.policy
        );

        const record: InvoiceRecord = {
          id,
          filename: safeOriginalName,
          mime_type: file.mimetype,
          has_file: true,
          vendor_name: extracted.vendor_name,
          invoice_number: extracted.invoice_number,
          invoice_date: extracted.invoice_date,
          currency: extracted.currency ? extracted.currency.toUpperCase() : null,
          line_items: validation.normalized_line_items,
          subtotal: extracted.subtotal !== null ? String(extracted.subtotal) : null,
          tax_amount: extracted.tax_amount !== null ? String(extracted.tax_amount) : null,
          total: extracted.total !== null ? String(extracted.total) : null,
          computed_subtotal: validation.computed_subtotal,
          computed_total: validation.computed_total,
          extraction_uncertain: Boolean(extracted.extraction_uncertain),
          uncertainty_notes: extracted.uncertainty_notes ?? null,
          validation_status: validation.validation_status,
          status: validation.validation_status,
          validation_results: validation.checks,
          review_decisions: [],
          audit_events: [
            {
              id: `ae-${crypto.randomUUID().slice(0, 8)}`,
              actor: 'User',
              event_type: 'UPLOADED',
              details: `Uploaded ${safeOriginalName} (${(file.size / 1024).toFixed(1)} KB)`,
              created_at: now,
            },
            {
              id: `ae-${crypto.randomUUID().slice(0, 8)}`,
              actor: 'Gemini Extractor',
              event_type: 'EXTRACTED',
              details: `Extracted ${validation.normalized_line_items.length} line item(s)`,
              created_at: new Date().toISOString(),
            },
            {
              id: `ae-${crypto.randomUUID().slice(0, 8)}`,
              actor: 'Deterministic Validator',
              event_type: 'VALIDATED',
              details: `Validation status set to ${validation.validation_status}`,
              created_at: new Date().toISOString(),
            },
          ],
          duplicate_of_id: validation.duplicate_of_id,
          created_at: now,
          updated_at: new Date().toISOString(),
        };

        db.invoices.unshift(record);
        saveDb(db);
        return res.status(201).json({ invoice: record });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invoice extraction failed.';
        return res.status(502).json({ error: message });
      }
    });
  });

  app.patch('/api/invoices/:id/fields', (req, res) => {
    const db = loadDb();
    const index = db.invoices.findIndex((i) => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice record not found.' });
    }
    const existing = db.invoices[index];
    const body = (req.body ?? {}) as Record<string, unknown>;
    const actor = typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : 'Reviewer';

    const updatedCandidate = {
      id: existing.id,
      vendor_name:
        body.vendor_name !== undefined
          ? typeof body.vendor_name === 'string'
            ? body.vendor_name
            : null
          : existing.vendor_name,
      invoice_number:
        body.invoice_number !== undefined
          ? typeof body.invoice_number === 'string'
            ? body.invoice_number
            : null
          : existing.invoice_number,
      invoice_date:
        body.invoice_date !== undefined
          ? typeof body.invoice_date === 'string'
            ? body.invoice_date
            : null
          : existing.invoice_date,
      currency:
        body.currency !== undefined
          ? typeof body.currency === 'string'
            ? body.currency.toUpperCase()
            : null
          : existing.currency,
      subtotal:
        body.subtotal !== undefined
          ? body.subtotal === null
            ? null
            : String(body.subtotal)
          : existing.subtotal,
      tax_amount:
        body.tax_amount !== undefined
          ? body.tax_amount === null
            ? null
            : String(body.tax_amount)
          : existing.tax_amount,
      total:
        body.total !== undefined
          ? body.total === null
            ? null
            : String(body.total)
          : existing.total,
      line_items: Array.isArray(body.line_items)
        ? body.line_items.map((l: Record<string, unknown>, idx: number) => ({
            id: typeof l.id === 'string' ? l.id : `line-${idx + 1}`,
            description: typeof l.description === 'string' ? l.description : `Item ${idx + 1}`,
            quantity: l.quantity !== undefined && l.quantity !== null ? String(l.quantity) : null,
            unit_price:
              l.unit_price !== undefined && l.unit_price !== null ? String(l.unit_price) : null,
            discount: l.discount !== undefined && l.discount !== null ? String(l.discount) : null,
            amount: l.amount !== undefined && l.amount !== null ? String(l.amount) : null,
          }))
        : existing.line_items,
      extraction_uncertain:
        typeof body.extraction_uncertain === 'boolean'
          ? body.extraction_uncertain
          : false,
      uncertainty_notes:
        typeof body.uncertainty_notes === 'string' ? body.uncertainty_notes : null,
    };

    const validation = validateInvoiceData(updatedCandidate, db.invoices, db.policy);
    const now = new Date().toISOString();

    const updated: InvoiceRecord = {
      ...existing,
      vendor_name: updatedCandidate.vendor_name,
      invoice_number: updatedCandidate.invoice_number,
      invoice_date: updatedCandidate.invoice_date,
      currency: updatedCandidate.currency,
      line_items: validation.normalized_line_items,
      subtotal: updatedCandidate.subtotal,
      tax_amount: updatedCandidate.tax_amount,
      total: updatedCandidate.total,
      computed_subtotal: validation.computed_subtotal,
      computed_total: validation.computed_total,
      extraction_uncertain: updatedCandidate.extraction_uncertain,
      uncertainty_notes: updatedCandidate.uncertainty_notes,
      validation_status: validation.validation_status,
      // Re-open workflow status upon field correction so previous approval cannot stand unverified
      status: validation.validation_status,
      validation_results: validation.checks,
      duplicate_of_id: validation.duplicate_of_id,
      audit_events: [
        ...existing.audit_events,
        {
          id: `ae-${crypto.randomUUID().slice(0, 8)}`,
          actor,
          event_type: 'FIELD_CORRECTED',
          details: 'Corrected extracted fields and cleared prior extraction uncertainty.',
          created_at: now,
        },
        {
          id: `ae-${crypto.randomUUID().slice(0, 8)}`,
          actor: 'Deterministic Validator',
          event_type: 'VALIDATED',
          details: `Re-evaluated rules: status is ${validation.validation_status}`,
          created_at: now,
        },
      ],
      updated_at: now,
    };

    db.invoices[index] = updated;
    saveDb(db);
    return res.json({ invoice: updated });
  });

  app.post('/api/invoices/:id/decision', (req, res) => {
    const db = loadDb();
    const index = db.invoices.findIndex((i) => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice record not found.' });
    }
    const existing = db.invoices[index];
    const body = (req.body ?? {}) as Record<string, unknown>;
    const decision = body.decision;
    const reviewerName =
      typeof body.reviewer_name === 'string' && body.reviewer_name.trim()
        ? body.reviewer_name.trim()
        : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (
      decision !== 'APPROVED' &&
      decision !== 'REJECTED' &&
      decision !== 'CORRECTION_REQUESTED'
    ) {
      return res.status(400).json({ error: 'Invalid review decision.' });
    }
    if (!reviewerName) {
      return res.status(400).json({ error: 'Reviewer name is required to record a decision.' });
    }

    const now = new Date().toISOString();
    const nextStatus =
      decision === 'APPROVED'
        ? 'APPROVED'
        : decision === 'REJECTED'
        ? 'REJECTED'
        : 'NEEDS_REVIEW';

    const updated: InvoiceRecord = {
      ...existing,
      status: nextStatus,
      review_decisions: [
        {
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          reviewer_name: reviewerName,
          decision,
          comment:
            comment ||
            (decision === 'APPROVED'
              ? 'Approved after human review.'
              : decision === 'REJECTED'
              ? 'Rejected during review.'
              : 'Correction requested.'),
          created_at: now,
        },
        ...existing.review_decisions,
      ],
      audit_events: [
        ...existing.audit_events,
        {
          id: `ae-${crypto.randomUUID().slice(0, 8)}`,
          actor: reviewerName,
          event_type: 'DECISION_RECORDED',
          details: `Recorded human decision: ${decision}${comment ? ` — ${comment}` : ''}`,
          created_at: now,
        },
      ],
      updated_at: now,
    };

    db.invoices[index] = updated;
    saveDb(db);
    return res.json({ invoice: updated });
  });

  app.delete('/api/invoices/:id', (req, res) => {
    const db = loadDb();
    const index = db.invoices.findIndex((i) => i.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Invoice record not found.' });
    }
    db.invoices.splice(index, 1);
    deleteStoredFile(req.params.id);
    saveDb(db);
    return res.json({ deleted: true });
  });

  app.get('/api/policy', (_req, res) => {
    const db = loadDb();
    res.json({ policy: db.policy });
  });

  app.put('/api/policy', (req, res) => {
    const db = loadDb();
    const body = (req.body ?? {}) as Partial<PolicyConfig>;
    const threshold = Number(body.approval_threshold);
    const tolerance = Number(body.arithmetic_tolerance);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return res.status(400).json({ error: 'Approval threshold must be a non-negative number.' });
    }
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 10) {
      return res.status(400).json({ error: 'Tolerance must be between 0.00 and 10.00.' });
    }

    db.policy = {
      approval_threshold: threshold.toFixed(2),
      arithmetic_tolerance: tolerance.toFixed(2),
      duplicate_check_enabled:
        typeof body.duplicate_check_enabled === 'boolean'
          ? body.duplicate_check_enabled
          : db.policy.duplicate_check_enabled,
      require_invoice_number:
        typeof body.require_invoice_number === 'boolean'
          ? body.require_invoice_number
          : db.policy.require_invoice_number,
    };
    saveDb(db);
    return res.json({ policy: db.policy });
  });

  app.post('/api/validator/run-tests', (_req, res) => {
    const db = loadDb();
    const results = runDeterministicTestSuite(db.policy);
    res.json({ results, policy: db.policy });
  });

  app.post('/api/invoices/reset-demo', (_req, res) => {
    const seed = buildDemoSeed();
    saveDb(seed);
    res.json({ invoices: seed.invoices, policy: seed.policy });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Invexa AI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
