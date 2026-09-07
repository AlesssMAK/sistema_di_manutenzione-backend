import { STRINGS, DEFAULT_EMAIL_LOCALE } from './i18n.js';

const interp = (str = '', ctx = {}) =>
  String(str).replace(/\{(\w+)\}/g, (_, k) =>
    ctx[k] != null ? String(ctx[k]) : '',
  );

const esc = (s = '') =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );

// Fields listed (in order) per fault-style email. Empty values are dropped.
const FIELD_ORDER = {
  newFault: ['plant', 'part', 'type', 'operator', 'comment'],
  sicurezzaHse: ['plant', 'part', 'type', 'operator', 'comment'],
  assignment: [
    'plant',
    'part',
    'type',
    'priority',
    'plannedDate',
    'plannedTime',
    'deadline',
    'managerComment',
  ],
  suspended: ['plant', 'part', 'type', 'reason', 'material'],
  reassign: ['plant', 'part', 'type', 'managerComment'],
  directMessage: ['author', 'message'],
};

// context → display value for each field key.
const FIELD_VALUE = {
  plant: (c) => c.plantName,
  part: (c) => c.partName,
  type: (c) => c.typeFault,
  operator: (c) => c.nameOperator,
  comment: (c) => c.comment,
  priority: (c) => c.priority,
  plannedDate: (c) => c.plannedDate,
  plannedTime: (c) => c.plannedTime,
  deadline: (c) => c.deadline,
  managerComment: (c) => c.managerComment,
  reason: (c) => c.suspensionReason,
  material: (c) => c.materialRequest,
  author: (c) => [c.authorName, c.authorRole].filter(Boolean).join(' · '),
  message: (c) => c.body,
};

const htmlShell = ({ greeting, intro, rowsHtml, cta, link, ifButtonFails, note, signature }) => `
<div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172b">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:28px">
    ${greeting ? `<p style="margin:0 0 12px;font-size:15px">${esc(greeting)}</p>` : ''}
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(intro)}</p>
    ${rowsHtml ? `<table style="border-collapse:collapse;margin:0 0 20px;font-size:14px">${rowsHtml}</table>` : ''}
    ${
      link && cta
        ? `<div style="margin:0 0 16px"><a href="${esc(link)}" style="display:inline-block;background:#155dfc;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${esc(cta)}</a></div>
    <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;line-height:1.5">${esc(ifButtonFails)}<br><a href="${esc(link)}" style="color:#155dfc;word-break:break-all">${esc(link)}</a></p>`
        : ''
    }
    ${note ? `<p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.5">${esc(note)}</p>` : ''}
    <p style="margin:20px 0 0;font-size:13px;color:#94a3b8">${esc(signature)}</p>
  </div>
</div>`;

// Builds { subject, html, text } for one email in the recipient's locale.
export const buildEmail = ({
  template,
  locale,
  context = {},
  signature = '',
}) => {
  const L = STRINGS[locale] ? locale : DEFAULT_EMAIL_LOCALE;
  const t = STRINGS[L];
  const tt = t[template] ?? {};
  const ctx = context;

  let subject;
  if (template === 'directMessage') {
    subject = ctx.subject
      ? interp(tt.subjectWith, ctx)
      : interp(tt.subjectNo, { author: ctx.authorName || 'Syllert' });
  } else {
    subject = interp(tt.subject, ctx);
  }

  const greeting = ctx.recipientName
    ? interp(t.common.greeting, { name: ctx.recipientName })
    : null;
  const intro = interp(tt.intro ?? '', ctx);

  const order = FIELD_ORDER[template] ?? [];
  const rows = order
    .map((key) => ({ label: t.fields[key], value: FIELD_VALUE[key](ctx) }))
    .filter((r) => r.value != null && String(r.value).trim() !== '');

  const { link } = ctx;
  const cta = tt.cta;
  const note = tt.note;

  const rowsHtml = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top">${esc(
          r.label,
        )}</td><td style="padding:4px 0;color:#0f172b">${esc(r.value)}</td></tr>`,
    )
    .join('');

  const html = htmlShell({
    greeting,
    intro,
    rowsHtml,
    cta,
    link,
    ifButtonFails: t.common.ifButtonFails,
    note,
    signature,
  });

  // Plain-text fallback (deliverability + non-HTML clients).
  const textParts = [];
  if (greeting) textParts.push(greeting);
  textParts.push(intro);
  if (rows.length) {
    textParts.push('');
    rows.forEach((r) => textParts.push(`${r.label}: ${r.value}`));
  }
  if (link && cta) {
    textParts.push('');
    textParts.push(`${cta}: ${link}`);
  }
  if (note) {
    textParts.push('');
    textParts.push(note);
  }
  textParts.push('');
  textParts.push(signature);
  const text = textParts.join('\n');

  return { subject, html, text };
};
