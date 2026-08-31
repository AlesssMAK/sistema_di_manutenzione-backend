import { describe, test, expect, beforeAll } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { createUser } from './helpers/fixtures.js';
import { loginAs } from './helpers/auth.js';

describe('messaging permission (canSendMessages)', () => {
  let app;
  beforeAll(() => {
    app = createTestApp();
  });

  test('operator without the flag receives messages but cannot send or reply', async () => {
    const opUser = await createUser({ role: 'operator', fullName: 'Op NoFlag' });
    const op = await loginAs(app, opUser);
    const mgrUser = await createUser({ role: 'manager' });
    const manager = await loginAs(app, mgrUser);

    // Cannot send.
    const send = await op
      .post('/messages/direct')
      .send({ recipientId: String(mgrUser.user._id), body: 'ciao' });
    expect(send.status).toBe(403);

    // A manager sends the operator a direct message → it lands in the inbox.
    const sent = await manager
      .post('/messages/direct')
      .send({ recipientId: String(opUser.user._id), body: 'ciao op' });
    expect(sent.status).toBe(201);

    // Receiving is open: the operator can read the inbox and sees it.
    const inbox = await op.get('/messages/inbox');
    expect(inbox.status).toBe(200);
    expect(inbox.body.total).toBeGreaterThanOrEqual(1);

    // Replying is sending, so it stays blocked.
    const reply = await op
      .post(`/messages/${sent.body._id}/reply`)
      .send({ body: 'no can do' });
    expect(reply.status).toBe(403);
  });

  test('operator WITH the flag can send and read the inbox', async () => {
    const op = await loginAs(
      app,
      await createUser({
        role: 'operator',
        fullName: 'Op Flagged',
        permissions: { canSendMessages: true },
      })
    );
    const manager = await createUser({ role: 'manager' });

    const send = await op
      .post('/messages/direct')
      .send({ recipientId: String(manager.user._id), body: 'ciao' });
    expect(send.status).toBe(201);

    const inbox = await op.get('/messages/inbox');
    expect(inbox.status).toBe(200);
  });

  test('non-operator can always send (201)', async () => {
    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const recipient = await createUser({ role: 'safety' });

    const send = await manager
      .post('/messages/direct')
      .send({ recipientId: String(recipient.user._id), body: 'ciao' });
    expect(send.status).toBe(201);
  });

  test('GET /messages/allowed-senders lists flagged operators (admin only)', async () => {
    const flaggedOp = await createUser({
      role: 'operator',
      fullName: 'Op Granted',
      permissions: { canSendMessages: true },
    });
    const admin = await loginAs(app, await createUser({ role: 'admin' }));

    const res = await admin.get('/messages/allowed-senders');
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u) => String(u._id));
    expect(ids).toContain(String(flaggedOp.user._id));

    const manager = await loginAs(app, await createUser({ role: 'manager' }));
    const denied = await manager.get('/messages/allowed-senders');
    expect(denied.status).toBe(403);
  });
});
