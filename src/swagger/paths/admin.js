/**
 * @swagger
 * tags:
 *   - name: Announcements
 *     description: Public bulletin board (la bacheca)
 *   - name: AuditLog
 *     description: Audit trail
 *   - name: SystemSettings
 *     description: Global configuration
 *   - name: Push
 *     description: Browser push subscriptions
 *   - name: Cron
 *     description: Manual triggers for the scheduled jobs
 *   - name: Generators
 *     description: Server-generated identifiers and secrets
 *
 * /public/announcements:
 *   get:
 *     summary: Read the public board
 *     description: The only endpoint that needs no authentication.
 *     tags:
 *       - Announcements
 *     parameters:
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
 *         name: category
 *         schema:
 *           type: string
 *           enum: [announcement, handover]
 *     responses:
 *       200:
 *         description: Paginated announcements
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
 *                     $ref: '#/components/schemas/Announcement'
 *
 * /announcements:
 *   post:
 *     summary: Publish an announcement
 *     description: >
 *       Requires the `canCreateAnnouncements` permission. Multipart request —
 *       up to 5 photos under `img`. Title and body may both be empty only
 *       when at least one photo is attached.
 *     tags:
 *       - Announcements
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               body:
 *                 type: string
 *                 maxLength: 5000
 *               category:
 *                 type: string
 *                 enum: [announcement, handover]
 *                 default: announcement
 *               plantId:
 *                 type: string
 *                 nullable: true
 *                 description: Optional machine reference, only meaningful for handover
 *               severity:
 *                 type: string
 *                 enum: [normal, communication, note, important, attention]
 *                 default: normal
 *               img:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Announcement published
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Announcement'
 *       400:
 *         description: Neither a photo nor title and body were provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Missing the canCreateAnnouncements permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /announcements/authors:
 *   get:
 *     summary: List users who may publish announcements
 *     tags:
 *       - Announcements
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Authorized authors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *
 * /announcements/{id}:
 *   delete:
 *     summary: Delete an announcement
 *     tags:
 *       - Announcements
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
 *         description: Announcement deleted
 *       403:
 *         description: Not allowed to delete this announcement
 *       404:
 *         description: Announcement not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /audit-log:
 *   get:
 *     summary: List audit records (Admin only)
 *     description: >
 *       `category` splits the dashboard: `access` selects the `auth.*`
 *       actions, `changes` selects everything else. `search` matches the
 *       actor's full name.
 *     tags:
 *       - AuditLog
 *     security:
 *       - cookieAuth: []
 *     parameters:
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
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [access, changes]
 *       - in: query
 *         name: search
 *         description: Free-text match on the actor's full name
 *         schema:
 *           type: string
 *           maxLength: 120
 *       - in: query
 *         name: actorId
 *         schema:
 *           type: string
 *       - in: query
 *         name: actorRole
 *         schema:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *             - system
 *       - in: query
 *         name: action
 *         description: Exact action name, e.g. `fault.statusChange`
 *         schema:
 *           type: string
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum:
 *             - User
 *             - Plant
 *             - PartPlant
 *             - Fault
 *             - Comment
 *             - SystemSettings
 *             - Session
 *             - Message
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         description: Must be later than `from`
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, -createdAt]
 *           default: -createdAt
 *     responses:
 *       200:
 *         description: Paginated audit records with the actor populated
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
 *                     $ref: '#/components/schemas/AuditLog'
 *       400:
 *         description: Invalid filter, or `to` is not later than `from`
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *
 * /audit-log/{id}:
 *   get:
 *     summary: Get one audit record (Admin only)
 *     tags:
 *       - AuditLog
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
 *         description: The audit record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Record not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /system-settings:
 *   get:
 *     summary: Read the settings any authenticated user may see
 *     description: Used by the client for scheduling — timezone, work hours and slots.
 *     tags:
 *       - SystemSettings
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Public subset of the settings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemSettings'
 *       401:
 *         description: Not authenticated
 *
 *   patch:
 *     summary: Update settings (Admin only)
 *     description: >
 *       Partial update — only the provided keys are applied. Validation
 *       rejects an end time earlier than the matching start time, both for
 *       the legacy `workHours` and for each enabled day in `weekSchedule`.
 *     tags:
 *       - SystemSettings
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SystemSettings'
 *     responses:
 *       200:
 *         description: Settings saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemSettings'
 *       400:
 *         description: Invalid timezone, malformed time, or end before start
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *
 * /system-settings/full:
 *   get:
 *     summary: Read every setting (Admin only)
 *     description: Includes the email, messaging and retention sections.
 *     tags:
 *       - SystemSettings
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complete settings document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemSettings'
 *       403:
 *         description: Not an admin
 *
 * /push/public-key:
 *   get:
 *     summary: Get the VAPID public key
 *     description: The browser needs this key to create a push subscription.
 *     tags:
 *       - Push
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The VAPID public key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publicKey:
 *                   type: string
 *
 * /push/subscribe:
 *   post:
 *     summary: Register a push subscription
 *     description: >
 *       Send the browser's `PushSubscription` JSON. The endpoint is unique,
 *       so re-subscribing the same browser updates the existing record
 *       instead of duplicating it. `expirationTime` is accepted and ignored.
 *     tags:
 *       - Push
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - keys
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *               keys:
 *                 type: object
 *                 required:
 *                   - p256dh
 *                   - auth
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *               expirationTime:
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Subscription stored
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PushSubscription'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *
 * /push/unsubscribe:
 *   post:
 *     summary: Remove a push subscription
 *     tags:
 *       - Push
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Subscription removed
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /admin/cron/replan:
 *   post:
 *     summary: Run the replan scan now (Admin only)
 *     description: >
 *       Manual trigger for the job node-cron runs on a schedule. Moves
 *       faults whose planned slot has passed to the next free slot.
 *       The run is recorded in the audit log.
 *     tags:
 *       - Cron
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Scan finished
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 scanned:
 *                   type: integer
 *                 replanned:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *       403:
 *         description: Not an admin
 *
 * /admin/cron/overdue:
 *   post:
 *     summary: Run the overdue scan now (Admin only)
 *     description: >
 *       Manual trigger for the job node-cron runs on a schedule. Marks
 *       active faults whose deadline has passed as `Overdue`, emitting a
 *       socket event per fault. The run is recorded in the audit log.
 *     tags:
 *       - Cron
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Scan finished
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 scanned:
 *                   type: integer
 *                 updated:
 *                   type: integer
 *       403:
 *         description: Not an admin
 *
 * /generate/id:
 *   get:
 *     summary: Generate the next fault code
 *     description: >
 *       Returns a sequential `SEG-YYYY-MM-NNN` code as a bare JSON string,
 *       to be sent back as `faultId` when creating a fault.
 *     tags:
 *       - Generators
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The generated code
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               example: SEG-2026-07-001
 *
 * /generate/personal-code:
 *   get:
 *     summary: Generate an operator personal code
 *     tags:
 *       - Generators
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The generated code
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               example: OP97513
 *
 * /generate/password:
 *   get:
 *     summary: Generate a password meeting the strength policy
 *     tags:
 *       - Generators
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The generated password
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 */
