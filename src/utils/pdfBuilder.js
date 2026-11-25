/**
 * Pure-JS multi-page PDF 1.4 binary generator for AANCHAL / Miora clinical & patient reports.
 * Produces valid, downloadable .pdf files without external dependencies.
 */

function escapePdfText(str) {
  return String(str || '')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u2194/g, '<->')
    .replace(/\u2206|\u0394/g, 'Delta ')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(text, maxLen = 86) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxLen) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Build a valid multi-page PDF 1.4 Blob from an array of plain-text lines.
 * First line is styled as the bold document title.
 */
export function buildMultiPagePdfBlob(rawLines = []) {
  const wrapped = rawLines.flatMap((line) => (line === '' ? [''] : wrapLine(line, 86)));
  const linesPerPage = 52;
  const pages = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) {
    pages.push(['AANCHAL Clinical Report']);
  }

  // Object layout:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5..: alternating Page obj and Contents stream obj
  const objects = [];
  const pageObjectIds = [];
  let nextId = 5;

  for (let pIdx = 0; pIdx < pages.length; pIdx += 1) {
    const pageObjId = nextId;
    const contentObjId = nextId + 1;
    nextId += 2;
    pageObjectIds.push(pageObjId);

    const pageLines = pages[pIdx];
    const ops = ['BT', '/F1 10 Tf', '48 758 Td', '13.5 TL'];
    pageLines.forEach((line, idx) => {
      const escaped = escapePdfText(line);
      if (pIdx === 0 && idx === 0) {
        ops.push('/F2 13 Tf', `(${escaped}) Tj`, '/F1 10 Tf');
      } else if (idx === 0) {
        ops.push(`(${escaped}) Tj`);
      } else {
        ops.push('T*', `(${escaped}) Tj`);
      }
    });
    ops.push('ET');
    const streamContent = ops.join('\n');

    objects.push({
      id: pageObjId,
      body: `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`,
    });
    objects.push({
      id: contentObjId,
      body: `${contentObjId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    });
  }

  const fixedObjects = [
    { id: 1, body: '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' },
    { id: 2, body: `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>\nendobj\n` },
    { id: 3, body: '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' },
    { id: 4, body: '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n' },
  ];

  const allObjects = [...fixedObjects, ...objects].sort((a, b) => a.id - b.id);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of allObjects) {
    offsets.push(pdf.length);
    pdf += obj.body;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${allObjects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function triggerBlobDownload(blob, filename) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
