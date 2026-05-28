import nodemailer from 'nodemailer';

let cached = null;
let cachedDriver = null;

const buildSmtpTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host) {
    throw new Error('SMTP_HOST is required when EMAIL_DRIVER=smtp');
  }

  const auth = user && pass ? { user, pass } : undefined;
  return nodemailer.createTransport({ host, port, secure, auth });
};

const buildStubTransporter = () => ({
  sendMail: async (message) => {
    console.log(
      `[email:stub] to=${message.to} subject="${message.subject}" (driver=stub, no SMTP send)`,
    );
    return { messageId: `stub-${Date.now()}`, accepted: [message.to], rejected: [] };
  },
});

export const getTransporter = () => {
  const driver = process.env.EMAIL_DRIVER ?? 'stub';
  if (cached && cachedDriver === driver) return cached;

  cached = driver === 'smtp' ? buildSmtpTransporter() : buildStubTransporter();
  cachedDriver = driver;
  console.log(`✉️  Email transporter ready (driver=${driver})`);
  return cached;
};

export const resetTransporter = () => {
  cached = null;
  cachedDriver = null;
};
