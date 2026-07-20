/**
 * @swagger
 * tags:
 *   - name: Messages
 *     description: Internal direct messages and broadcasts
 *
 * /messages/direct:
 *   post:
 *     summary: Send a direct message
 *     description: >
 *       Multipart request — up to 5 images may be attached under `img`.
 *       Sending is gated per role; operators additionally need the
 *       `canSendMessages` permission. Rate-limited per hour by the value in
 *       system settings.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - body
 *             properties:
 *               recipientId:
 *                 type: string
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *                 default: ''
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - recipientId
 *               - body
 *             properties:
 *               recipientId:
 *                 type: string
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               img:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: The caller's role or permissions do not allow direct messaging
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Hourly direct-message limit reached
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /messages/broadcast:
 *   post:
 *     summary: Broadcast a message
 *     description: >
 *       `target: all` reaches everyone; `target: role` requires `targetRole`
 *       and is forbidden otherwise. Broadcasts expire after the configured
 *       TTL, unlike direct messages.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target
 *               - body
 *             properties:
 *               target:
 *                 type: string
 *                 enum: [all, role]
 *               targetRole:
 *                 type: string
 *                 description: Required when target is `role`, forbidden when `all`
 *                 enum:
 *                   - operator
 *                   - admin
 *                   - manager
 *                   - maintenanceWorker
 *                   - safety
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Broadcast created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error, or targetRole sent with target=all
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not allowed to broadcast
 *
 * /messages/inbox:
 *   get:
 *     summary: List direct messages
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: box
 *         schema:
 *           type: string
 *           enum: [inbox, sent, all]
 *           default: inbox
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Paginated messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       403:
 *         description: The caller's role or permissions do not allow an inbox
 *
 * /messages/announcements:
 *   get:
 *     summary: List broadcast messages addressed to the caller
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: types
 *         description: >
 *           Comma-separated filter — `broadcast_all`, `broadcast_role`,
 *           or both. Lets one endpoint serve both the bell dropdown and
 *           the full board.
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Paginated broadcasts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *
 * /messages/unread-count:
 *   get:
 *     summary: Unread counters split by bucket
 *     description: Powers the header bell badge.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 direct:
 *                   type: integer
 *                 roleAnnouncements:
 *                   type: integer
 *                 allAnnouncements:
 *                   type: integer
 *
 * /messages/allowed-senders:
 *   get:
 *     summary: List users the caller may message
 *     description: Used to populate the recipient picker in the compose form.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Allowed recipients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       403:
 *         description: The caller is not allowed to send messages
 *
 * /messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message deleted
 *       403:
 *         description: Not the author
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /messages/{id}/read:
 *   patch:
 *     summary: Mark a message as read
 *     description: Adds the caller to `readBy`; calling it twice is harmless.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /messages/{id}/reply:
 *   post:
 *     summary: Reply to a message
 *     description: >
 *       Creates a direct message back to the original author with
 *       `replyToId` set, so the client can render a thread. Works for
 *       replies to broadcasts too. Accepts image attachments.
 *     tags:
 *       - Messages
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               subject:
 *                 type: string
 *                 maxLength: 200
 *               body:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               img:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Reply sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error, or replying to yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Original message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
