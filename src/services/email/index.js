import { getSettings } from '../systemSettings.js';
import { getTransporter } from './transporter.js';
import { renderTemplate } from './templates.js';
import { checkAndConsume } from './rateLimiter.js';

const FRONTEND_URL = () => process.env.FRONTEND_URL ?? 'http://localhost:3000';

const subjectFor = (template, ctx) => {
  switch (template) {
    case 'newFault':
      return `Nuova segnalazione: ${ctx.faultId}`;
    case 'assignment':
      return `Nuovo intervento assegnato: ${ctx.faultId}`;
    case 'sicurezzaHse':
      return `[SICUREZZA] Nuova segnalazione: ${ctx.faultId}`;
    case 'directMessage':
      return ctx.subject
        ? `[MMS] ${ctx.subject}`
        : `Nuovo messaggio da ${ctx.authorName ?? 'MMS'}`;
    default:
      return `MMS: ${ctx.faultId ?? ''}`.trim();
  }
};

const sendOne = async ({ to, template, context, from }) => {
  const gate = await checkAndConsume(to);
  if (!gate.allowed) {
    console.warn(
      `[email] rate-limit hit for ${to} (used=${gate.used}/${gate.limit}); skipping ${template}`,
    );
    return { skipped: true, reason: 'rate_limited' };
  }

  const body = await renderTemplate(template, context);
  const subject = subjectFor(template, context);

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({ from, to, subject, text: body });
    return { skipped: false, messageId: result.messageId };
  } catch (err) {
    console.error(`[email] send failed to=${to} template=${template}`, err.message);
    return { skipped: true, reason: 'transport_error', error: err.message };
  }
};

const sendBulk = async ({ recipients, template, contextFor, from }) => {
  const tasks = recipients
    .filter((r) => r?.email)
    .map((r) =>
      sendOne({ to: r.email, template, context: contextFor(r), from }),
    );
  return Promise.allSettled(tasks);
};

const guard = async (triggerKey) => {
  const settings = await getSettings();
  if (!settings?.email?.enabled) return { ok: false, reason: 'email_disabled' };
  if (!settings?.email?.triggers?.[triggerKey]) {
    return { ok: false, reason: `trigger_${triggerKey}_disabled` };
  }
  return { ok: true, settings };
};

const buildLink = (rolePath, faultId) =>
  `${FRONTEND_URL()}/${rolePath}/${faultId}`;

const baseFaultContext = (fault) => ({
  faultId: fault.faultId ?? String(fault._id),
  nameOperator: fault.nameOperator ?? '',
  plantName: fault.plantId?.namePlant ?? '',
  partName: fault.partId?.namePlantPart ?? '',
  typeFault: fault.typeFault ?? '',
  comment: fault.comment ?? '',
});

export const sendNewFaultEmail = async (fault, managers) => {
  const gate = await guard('onNewFault');
  if (!gate.ok) return { skipped: true, reason: gate.reason };
  if (!managers?.length) return { skipped: true, reason: 'no_managers' };

  return sendBulk({
    recipients: managers,
    template: 'newFault',
    from: gate.settings.email.from,
    contextFor: () => ({
      ...baseFaultContext(fault),
      link: buildLink('manager', fault._id),
    }),
  });
};

export const sendSicurezzaHseEmail = async (fault, hseUsers) => {
  const gate = await guard('onSicurezzaHse');
  if (!gate.ok) return { skipped: true, reason: gate.reason };
  if (!hseUsers?.length) return { skipped: true, reason: 'no_hse_users' };

  return sendBulk({
    recipients: hseUsers,
    template: 'sicurezzaHse',
    from: gate.settings.email.from,
    contextFor: () => ({
      ...baseFaultContext(fault),
      link: buildLink('safety', fault._id),
    }),
  });
};

export const sendDirectMessageEmail = async (message, recipient) => {
  const gate = await guard('onDirectMessage');
  if (!gate.ok) return { skipped: true, reason: gate.reason };
  if (!recipient?.email) return { skipped: true, reason: 'no_recipient_email' };

  return sendBulk({
    recipients: [recipient],
    template: 'directMessage',
    from: gate.settings.email.from,
    contextFor: () => ({
      recipientName: recipient.fullName ?? '',
      authorName: message.authorName ?? '',
      authorRole: message.authorRole ?? '',
      subject: message.subject ?? '',
      body: message.body ?? '',
      link: `${FRONTEND_URL()}/inbox/${message.authorId}`,
    }),
  });
};

export const sendAssignmentEmail = async (fault, maintainers) => {
  const gate = await guard('onAssignment');
  if (!gate.ok) return { skipped: true, reason: gate.reason };
  if (!maintainers?.length) return { skipped: true, reason: 'no_maintainers' };

  return sendBulk({
    recipients: maintainers,
    template: 'assignment',
    from: gate.settings.email.from,
    contextFor: (recipient) => ({
      ...baseFaultContext(fault),
      recipientName: recipient.fullName ?? recipient.name ?? '',
      priority: fault.priority ?? '',
      plannedDate: fault.plannedDate ?? '',
      plannedTime: fault.plannedTime ?? '',
      estimatedDuration: fault.estimatedDuration ?? '',
      deadline: fault.deadline ?? '',
      managerComment: fault.managerComment ?? '',
      link: buildLink('maintenance-worker', fault._id),
    }),
  });
};
