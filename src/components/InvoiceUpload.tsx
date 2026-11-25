import { AlertCircle, FileUp, Loader2, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import type { InvoiceRecord } from '../types/invoice.ts';
import {
  generateSampleInvoiceFile,
  SAMPLE_TEMPLATES,
  type SampleTemplate,
} from '../utils/sampleInvoiceGenerator.ts';

interface InvoiceUploadProps {
  onAnalyzed: (invoice: InvoiceRecord) => void;
}

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_BYTES = 10 * 1024 * 1024;

export function InvoiceUpload({ onAnalyzed }: InvoiceUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitFile(file: File) {
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError('Unsupported file type. Please upload a PDF, PNG, or JPEG file.');
      return;
    }
    if (file.size === 0) {
      setError('The selected file is empty.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File exceeds the 10 MB upload limit.');
      return;
    }

    setUploading(true);
    setStatusLabel(`Extracting and validating ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/invoices/analyze', {
        method: 'POST',
        body: formData,
      });
      const payload = (await res.json()) as { invoice?: InvoiceRecord; error?: string };

      if (!res.ok || !payload.invoice) {
        throw new Error(payload.error || 'Failed to process invoice.');
      }

      onAnalyzed(payload.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected upload failure.');
    } finally {
      setUploading(false);
      setActiveSampleId(null);
      setStatusLabel(null);
    }
  }

  async function handleSampleRun(template: SampleTemplate) {
    if (uploading) return;
    setError(null);
    setActiveSampleId(template.id);
    try {
      const file = await generateSampleInvoiceFile(template);
      await submitFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate sample invoice.');
      setActiveSampleId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Upload Invoice
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Submit a PDF, PNG, or JPEG invoice. Fields are extracted into a strict schema, then verified deterministically by backend arithmetic and policy rules.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) void submitFile(dropped);
        }}
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors bg-white dark:bg-slate-900 ${
          dragging
            ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void submitFile(file);
            e.target.value = '';
          }}
        />

        <div className="mx-auto max-w-md space-y-4">
          <div className="mx-auto h-11 w-11 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {uploading ? statusLabel : 'Drag and drop an invoice document here'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Accepted formats: PDF, PNG, JPEG · Maximum size 10 MB
            </p>
          </div>

          <div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Browse Files</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-sm"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium">Upload or extraction stopped</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Synthetic sample tests */}
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Synthetic Sample Invoices
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Generate a synthetic PNG invoice in your browser and send it through the live Gemini extraction and deterministic validation pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SAMPLE_TEMPLATES.map((sample) => {
            const isRunning = activeSampleId === sample.id;
            return (
              <div
                key={sample.id}
                className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {sample.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {sample.subtitle}
                  </p>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                    {sample.expectedOutcome}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleSampleRun(sample)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isRunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{isRunning ? 'Analyzing...' : 'Run Sample'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
