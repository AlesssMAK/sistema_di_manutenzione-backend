import { getSettings } from './systemSettings.js';
import { sendPushToUsers } from './push/index.js';

// Notify the admin-configured users when items drop to/below their
// reorder point (or go negative). Fire-and-forget — the caller never
// waits on it, so a failed/absent push never blocks a stock movement.
export const notifyLowStock = async (lowItems, warehouse) => {
  try {
    if (!lowItems?.length) return;
    const settings = await getSettings();
    const cfg = settings?.warehouse?.lowStock;
    if (!cfg?.notify || !cfg.userIds?.length) return;

    const shown = lowItems
      .slice(0, 5)
      .map((i) => i.name ?? 'articolo')
      .join(', ');
    const more = lowItems.length > 5 ? ` +${lowItems.length - 5}` : '';

    const payload = {
      title: 'Scorta bassa a magazzino',
      body: `${warehouse?.name ?? 'Magazzino'}: ${shown}${more}`,
      url: '/warehouse',
      tag: 'warehouse-low-stock',
    };

    await sendPushToUsers(cfg.userIds, payload);
  } catch (err) {
    console.error('[warehouseAlerts] low-stock notify failed', err.message);
  }
};

// True when a level should raise a low-stock alert: at/below a real
// reorder point, or negative. minLevel 0 alone isn't "low" (avoids
// alerting on every item that simply reaches zero without a set point).
export const isLowForAlert = (quantity, minLevel) =>
  quantity < 0 || (minLevel > 0 && quantity <= minLevel);
