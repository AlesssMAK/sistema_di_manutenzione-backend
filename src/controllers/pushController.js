import { PushSubscription } from '../models/pushSubscription.js';

// Browser hands us the PushSubscription JSON; we store it against the
// current user. Upsert on endpoint so re-subscribing the same browser
// (or a key rotation) updates rather than duplicates.
export const subscribePush = async (req, res) => {
  const { endpoint, keys } = req.body;
  const userAgent = req.headers['user-agent']?.slice(0, 512) ?? null;

  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: req.user._id, endpoint, keys, userAgent },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  res.status(201).json({ success: true });
};

export const unsubscribePush = async (req, res) => {
  const { endpoint } = req.body;
  await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
  res.status(200).json({ success: true });
};

// Public VAPID key for the frontend to subscribe with.
export const getPushPublicKey = async (req, res) => {
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
};
