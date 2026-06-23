import webpush from 'web-push';
import { PushSubscription } from '../../models/pushSubscription.js';
import { User } from '../../models/user.js';

let configured = false;

// Lazily wire VAPID on first use. If keys are missing the whole
// service no-ops (subscribe endpoints still work, just nothing is
// delivered) so the app runs fine in dev without push configured.
const ensureConfigured = () => {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:noreply@mms.local',
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
};

const sendToSubscription = async (sub, payload) => {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
  } catch (err) {
    // 404/410 = subscription is dead (browser revoked / expired);
    // prune it so we don't keep retrying. Anything else is logged.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await PushSubscription.deleteOne({ _id: sub._id });
    } else {
      console.error('[push] send failed', err.statusCode, err.message);
    }
  }
};

// payload shape used by the service worker: { title, body, url, tag }
export const sendPushToUser = async (userId, payload) => {
  if (!ensureConfigured() || !userId) return;
  const subs = await PushSubscription.find({ userId }).lean();
  await Promise.allSettled(subs.map((s) => sendToSubscription(s, payload)));
};

export const sendPushToRole = async (role, payload) => {
  if (!ensureConfigured() || !role) return;
  const users = await User.find({ role, status: 'active' }, '_id').lean();
  if (!users.length) return;
  const subs = await PushSubscription.find({
    userId: { $in: users.map((u) => u._id) },
  }).lean();
  await Promise.allSettled(subs.map((s) => sendToSubscription(s, payload)));
};

export const sendPushToUsers = async (userIds, payload) => {
  if (!ensureConfigured() || !userIds?.length) return;
  const subs = await PushSubscription.find({
    userId: { $in: userIds },
  }).lean();
  await Promise.allSettled(subs.map((s) => sendToSubscription(s, payload)));
};
