import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePdfBuffer,
  PDF_ERROR_CORRUPT,
  PDF_ERROR_SCANNED,
} from '../src/utils/pdfParser.js';

const SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n'
  + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
  + '4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 50 100 Td (Hello OWNAI PDF) Tj ET\nendstream\nendobj\n'
  + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'
  + 'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000270 00000 n \n0000000363 00000 n \n'
  + 'trailer<</Size 6/Root 1 0 R>>\nstartxref\n432\n%%EOF',
);

describe('parsePdfBuffer', () => {
  it('extracts text from a valid PDF buffer', async () => {
    const result = await parsePdfBuffer(SAMPLE_PDF);
    assert.equal(result.scanned, false);
    assert.match(result.text, /Hello OWNAI PDF/);
  });

  it('reports scanned PDFs with no extractable text', async () => {
    const emptyPagePdf = Buffer.from(
      '%PDF-1.4\n'
      + '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
      + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
      + '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n'
      + 'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n'
      + 'trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF',
    );
    const result = await parsePdfBuffer(emptyPagePdf);
    assert.equal(result.text, null);
    assert.equal(result.scanned, true);
    assert.equal(result.error, PDF_ERROR_SCANNED);
  });

  it('throws a clear error for corrupt PDF data', async () => {
    await assert.rejects(
      () => parsePdfBuffer(Buffer.from('not a pdf')),
      (error) => {
        assert.equal(error.message, PDF_ERROR_CORRUPT);
        return true;
      },
    );
  });

  it('throws for empty buffers', async () => {
    await assert.rejects(
      () => parsePdfBuffer(Buffer.alloc(0)),
      (error) => {
        assert.equal(error.message, PDF_ERROR_CORRUPT);
        return true;
      },
    );
  });
});
