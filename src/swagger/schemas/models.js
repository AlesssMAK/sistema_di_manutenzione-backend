/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       description: >
 *         Application user. `password`, `personalCode`, `resetPasswordToken`
 *         and `resetPasswordExpires` are stripped by `toJSON()` and never
 *         appear in API responses.
 *       required:
 *         - role
 *         - fullName
 *         - email
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated user ID
 *           example: 64f0c2a9b9a1c2a1a1234567
 *         role:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *           default: operator
 *           example: maintenanceWorker
 *         fullName:
 *           type: string
 *           description: Full name, also used as a login identifier for operators
 *           example: Mario Rossi
 *         email:
 *           type: string
 *           format: email
 *           description: Unique email address, required for every role
 *           example: mario.rossi@example.com
 *         personalCode:
 *           type: string
 *           pattern: '^[A-Z]{2}\d{5}$'
 *           description: >
 *             Operator login secret (required when role is `operator`,
 *             unused otherwise). Write-only — never returned.
 *           example: OP00001
 *         avatar:
 *           type: string
 *           default: ''
 *           example: https://res.cloudinary.com/demo/image.jpg
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - deactivated
 *           default: active
 *           example: active
 *         isFirstLogin:
 *           type: boolean
 *           default: true
 *           description: Tracks whether the user still has to change the initial password
 *         permissions:
 *           type: object
 *           description: Admin-granted per-user rights, managed from the settings tab
 *           properties:
 *             canCreateAnnouncements:
 *               type: boolean
 *               default: false
 *               description: Allows publishing to the public board
 *             canSendMessages:
 *               type: boolean
 *               default: false
 *               description: Lets an operator use direct messaging
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     UserUpdate:
 *       type: object
 *       description: >
 *         Admin-editable subset of a user. Every field is optional — only the
 *         ones present are applied. Anything outside this list is ignored.
 *       properties:
 *         role:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *         fullName:
 *           type: string
 *           example: Mario Rossi
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           description: Hashed before storage; required when moving a user off the operator role
 *         personalCode:
 *           type: string
 *           pattern: '^[A-Z]{2}\d{5}$'
 *           description: Required when assigning the operator role
 *         avatar:
 *           type: string
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - deactivated
 *         permissions:
 *           type: object
 *           description: Merged with the current grants rather than replacing them
 *           properties:
 *             canCreateAnnouncements:
 *               type: boolean
 *             canSendMessages:
 *               type: boolean
 *
 *     Plant:
 *       type: object
 *       required:
 *         - namePlant
 *         - code
 *         - location
 *       properties:
 *         _id:
 *           type: string
 *           example: 65a1b2c3d4e5f6a7b8c9d0e1
 *         namePlant:
 *           type: string
 *           example: Linea Estrusione 1
 *         code:
 *           type: string
 *           example: EXT-01
 *         location:
 *           type: string
 *           example: Reparto Nord
 *         description:
 *           type: string
 *           nullable: true
 *           example: Linea principale di estrusione
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - deactivated
 *           default: active
 *           description: Deleting a plant deactivates it instead of removing the document
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PlantPart:
 *       type: object
 *       description: >
 *         A component of a plant. Codes are unique per plant, so two plants
 *         may reuse the same part code.
 *       required:
 *         - plantId
 *         - namePlantPart
 *         - codePlantPart
 *       properties:
 *         _id:
 *           type: string
 *           example: 65b2c3d4e5f6a7b8c9d0e1f2
 *         plantId:
 *           type: string
 *           description: Reference to the parent Plant
 *           example: 65a1b2c3d4e5f6a7b8c9d0e1
 *         namePlantPart:
 *           type: string
 *           example: Motore principale
 *         codePlantPart:
 *           type: string
 *           description: Unique within the parent plant
 *           example: MOT-01
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - deactivated
 *           default: active
 *           description: Deleting a part deactivates it instead of removing the document
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Fault:
 *       type: object
 *       description: >
 *         A maintenance request (segnalazione). Dates handled by the
 *         scheduling cron are stored as `YYYY-MM-DD` strings and times as
 *         `HH:mm`, not as Date objects.
 *       required:
 *         - faultId
 *         - nameOperator
 *         - userId
 *         - dataCreated
 *         - timeCreated
 *         - plantId
 *         - partId
 *         - comment
 *       properties:
 *         _id:
 *           type: string
 *           example: 65c12f8a9e1b2c0012a3b456
 *         faultId:
 *           type: string
 *           description: Human-readable sequential identifier
 *           example: F-000123
 *         nameOperator:
 *           type: string
 *           description: Name of the operator who reported the fault
 *           example: Mario Rossi
 *         userId:
 *           type: string
 *           description: ID of the reporting operator
 *           example: 65c12f8a9e1b2c0012a3b111
 *         dataCreated:
 *           type: string
 *           format: date-time
 *         timeCreated:
 *           type: string
 *           example: '14:32'
 *         plantId:
 *           type: string
 *           description: Referenced Plant (populated on detail and list endpoints)
 *         partId:
 *           type: string
 *           description: Referenced PlantPart
 *         typeFault:
 *           type: string
 *           enum:
 *             - Production
 *             - Safety
 *           default: Production
 *         statusFault:
 *           type: string
 *           enum:
 *             - Created
 *             - In progress
 *             - Completed
 *             - Suspended
 *             - Overdue
 *           default: Created
 *           description: '`Overdue` is set automatically by the cron job'
 *         comment:
 *           type: string
 *           description: Problem description written by the operator
 *         img:
 *           type: array
 *           description: Cloudinary URLs of attached photos
 *           items:
 *             type: string
 *           default: []
 *         priority:
 *           type: string
 *           enum:
 *             - Low
 *             - Medium
 *             - High
 *           default: Medium
 *         assignedMaintainers:
 *           type: array
 *           description: >
 *             Assigned maintenance workers. Returned as populated objects
 *             (`fullName`, `email`) by the list and detail endpoints.
 *           items:
 *             type: string
 *         managerComment:
 *           type: string
 *           description: Note left by the manager when planning
 *         deadline:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *           example: '2026-02-15'
 *         plannedDate:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *           example: '2026-02-12'
 *         plannedTime:
 *           type: string
 *           pattern: '^\d{2}:\d{2}$'
 *           example: '10:30'
 *         estimatedDuration:
 *           type: number
 *           description: Estimated work duration in minutes
 *           default: 60
 *         managerId:
 *           type: string
 *           description: Manager who planned the fault
 *         commentMaintenanceWorker:
 *           type: string
 *           description: Note left by the maintenance worker
 *         commentSafety:
 *           type: string
 *           description: Note left by the HSE / safety role
 *         actualDuration:
 *           type: number
 *           minimum: 1
 *           description: Real duration in minutes, reported on completion
 *         suspensionReason:
 *           type: string
 *           description: Required context when the status moves to `Suspended`
 *         materialRequest:
 *           type: string
 *           description: Materials requested by the maintenance worker
 *         completedAt:
 *           type: string
 *           format: date-time
 *         claimedBy:
 *           type: string
 *           description: Maintenance worker who claimed a pool fault
 *         claimedAt:
 *           type: string
 *           format: date-time
 *         autoRescheduledFrom:
 *           type: object
 *           description: Previous slot, set when the replan cron moves a fault
 *           properties:
 *             plannedDate:
 *               type: string
 *             plannedTime:
 *               type: string
 *             timestamp:
 *               type: string
 *               format: date-time
 *         history:
 *           type: array
 *           description: Append-only trail of changes
 *           items:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 example: auto_overdue
 *               userId:
 *                 type: string
 *                 nullable: true
 *               userName:
 *                 type: string
 *                 example: system
 *               changes:
 *                 type: object
 *                 description: Free-form old/new values
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Message:
 *       type: object
 *       description: >
 *         Internal communication. `direct` requires `recipientId`,
 *         `broadcast_role` requires `targetRole`, and `broadcast_all`
 *         allows neither. Broadcasts expire via `expireAt`; direct
 *         messages are kept indefinitely.
 *       required:
 *         - type
 *         - authorId
 *         - authorName
 *         - authorRole
 *         - body
 *       properties:
 *         _id:
 *           type: string
 *         type:
 *           type: string
 *           enum:
 *             - direct
 *             - broadcast_all
 *             - broadcast_role
 *         authorId:
 *           type: string
 *         authorName:
 *           type: string
 *           maxLength: 200
 *         authorRole:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *         recipientId:
 *           type: string
 *           nullable: true
 *           description: Direct messages only
 *         targetRole:
 *           type: string
 *           nullable: true
 *           description: Broadcast-to-role messages only
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *         subject:
 *           type: string
 *           maxLength: 200
 *           default: ''
 *         body:
 *           type: string
 *           minLength: 1
 *           maxLength: 5000
 *         img:
 *           type: array
 *           description: Cloudinary URLs, max 5 attachments
 *           items:
 *             type: string
 *         readBy:
 *           type: array
 *           description: IDs of users who have read the message
 *           items:
 *             type: string
 *         replyToId:
 *           type: string
 *           nullable: true
 *           description: Set on replies, points at the original message
 *         expireAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: TTL for broadcasts; null on direct messages
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Announcement:
 *       type: object
 *       description: >
 *         Public bulletin board entry. Readable without authentication;
 *         creation is gated by the `canCreateAnnouncements` permission.
 *         Title and body are optional when a photo is attached.
 *       required:
 *         - authorId
 *         - authorName
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *           maxLength: 200
 *           default: ''
 *         body:
 *           type: string
 *           maxLength: 5000
 *           default: ''
 *         authorId:
 *           type: string
 *         authorName:
 *           type: string
 *         category:
 *           type: string
 *           enum:
 *             - announcement
 *             - handover
 *           default: announcement
 *           description: '`handover` entries are shift notes and may reference a machine'
 *         plantId:
 *           type: string
 *           nullable: true
 *           description: Optional machine reference, meaningful for handover entries
 *         plantName:
 *           type: string
 *           nullable: true
 *           description: Denormalized so the public board renders without a populate
 *         severity:
 *           type: string
 *           enum:
 *             - normal
 *             - communication
 *             - note
 *             - important
 *             - attention
 *           default: normal
 *         img:
 *           type: array
 *           description: Cloudinary URLs, max 5 photos
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     AuditLog:
 *       type: object
 *       description: >
 *         Append-only audit record. Sensitive keys (passwords, tokens,
 *         cookies) are redacted from `meta` before storage. Records are
 *         pruned by the retention TTL configured in system settings.
 *       required:
 *         - actorRole
 *         - action
 *       properties:
 *         _id:
 *           type: string
 *         actorId:
 *           type: string
 *           nullable: true
 *           description: Null for actions performed by the system (cron)
 *         actorRole:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *             - system
 *         action:
 *           type: string
 *           description: >
 *             Dotted action name. Grouped as `auth.*`, `user.*`, `plant.*`,
 *             `part.*`, `fault.*`, `comment.*`, `settings.*`, `message.*`
 *             and `cron.*` — the audit dashboard splits `auth.*` (access)
 *             from everything else (changes).
 *           example: fault.statusChange
 *         targetType:
 *           type: string
 *           nullable: true
 *           enum:
 *             - User
 *             - Plant
 *             - PartPlant
 *             - Fault
 *             - Comment
 *             - SystemSettings
 *             - Session
 *             - Message
 *         targetId:
 *           type: string
 *           nullable: true
 *         summary:
 *           type: string
 *           maxLength: 500
 *         meta:
 *           type: object
 *           nullable: true
 *           description: Free-form context; ObjectId and Buffer values are hex-encoded
 *         ip:
 *           type: string
 *           nullable: true
 *         userAgent:
 *           type: string
 *           nullable: true
 *           maxLength: 512
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     SystemSettings:
 *       type: object
 *       description: >
 *         Global singleton (`_id` is always `global`) holding scheduling,
 *         email, messaging and retention configuration.
 *       properties:
 *         _id:
 *           type: string
 *           default: global
 *         timezone:
 *           type: string
 *           description: IANA timezone, validated on save
 *           default: Europe/Rome
 *           example: Europe/Rome
 *         workHours:
 *           type: object
 *           description: Legacy global hours, kept for backward compatibility
 *           properties:
 *             start:
 *               type: string
 *               pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *               example: '08:00'
 *             end:
 *               type: string
 *               pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *               example: '17:00'
 *         workDays:
 *           type: array
 *           description: Weekday numbers 0..6, Sunday is 0
 *           items:
 *             type: integer
 *             minimum: 0
 *             maximum: 6
 *           default: [1, 2, 3, 4, 5]
 *         weekSchedule:
 *           type: object
 *           description: >
 *             Per-day schedule and the source of truth for planning.
 *             A closed day has `enabled: false`; 24h is `00:00`–`23:59`.
 *           properties:
 *             mon:
 *               $ref: '#/components/schemas/DaySchedule'
 *             tue:
 *               $ref: '#/components/schemas/DaySchedule'
 *             wed:
 *               $ref: '#/components/schemas/DaySchedule'
 *             thu:
 *               $ref: '#/components/schemas/DaySchedule'
 *             fri:
 *               $ref: '#/components/schemas/DaySchedule'
 *             sat:
 *               $ref: '#/components/schemas/DaySchedule'
 *             sun:
 *               $ref: '#/components/schemas/DaySchedule'
 *         slotDurationMinutes:
 *           type: integer
 *           minimum: 5
 *           maximum: 240
 *           default: 30
 *         holidays:
 *           type: array
 *           description: Dates on which no work is scheduled
 *           items:
 *             type: string
 *             format: date-time
 *         email:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               default: true
 *             from:
 *               type: string
 *               default: noreply@mms.local
 *               description: Sender address used for every outbound email
 *             triggers:
 *               type: object
 *               description: Per-event switches for outbound email
 *               properties:
 *                 onAssignment:
 *                   type: boolean
 *                 onNewFault:
 *                   type: boolean
 *                 onSicurezzaHse:
 *                   type: boolean
 *                 onDirectMessage:
 *                   type: boolean
 *                 onSuspended:
 *                   type: boolean
 *                 onReassign:
 *                   type: boolean
 *             rateLimits:
 *               type: object
 *               properties:
 *                 perRecipientPerHour:
 *                   type: integer
 *                   minimum: 0
 *                   default: 10
 *         messaging:
 *           type: object
 *           properties:
 *             broadcastTtlDays:
 *               type: integer
 *               minimum: 1
 *               maximum: 365
 *               default: 30
 *             directRateLimitPerHour:
 *               type: integer
 *               minimum: 0
 *               default: 30
 *         retention:
 *           type: object
 *           properties:
 *             auditLogDays:
 *               type: integer
 *               minimum: 1
 *               maximum: 3650
 *               default: 90
 *             completedFaultsArchiveMonths:
 *               type: integer
 *               nullable: true
 *               minimum: 1
 *               maximum: 120
 *         updatedBy:
 *           type: string
 *           nullable: true
 *           description: Last admin who saved the settings
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     DaySchedule:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           default: false
 *         start:
 *           type: string
 *           pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *           default: '08:00'
 *         end:
 *           type: string
 *           pattern: '^([01]\d|2[0-3]):([0-5]\d)$'
 *           default: '17:00'
 *
 *     PushSubscription:
 *       type: object
 *       description: >
 *         One record per browser or device that granted push permission.
 *         `endpoint` is globally unique, so re-subscribing upserts.
 *       required:
 *         - userId
 *         - endpoint
 *         - keys
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *         endpoint:
 *           type: string
 *           example: https://fcm.googleapis.com/fcm/send/abc123
 *         keys:
 *           type: object
 *           required:
 *             - p256dh
 *             - auth
 *           properties:
 *             p256dh:
 *               type: string
 *             auth:
 *               type: string
 *         userAgent:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Session:
 *       type: object
 *       description: >
 *         Server-side session. The tokens are opaque values delivered as
 *         httpOnly cookies — the client never reads them.
 *       required:
 *         - userId
 *         - accessToken
 *         - refreshToken
 *         - accessTokenValidUntil
 *         - refreshTokenValidUntil
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
 *           description: Reference to the User ID
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *         accessTokenValidUntil:
 *           type: string
 *           format: date-time
 *         refreshTokenValidUntil:
 *           type: string
 *           format: date-time
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         perPage:
 *           type: integer
 *           example: 10
 *         totalItems:
 *           type: integer
 *           example: 48
 *         totalPages:
 *           type: integer
 *           example: 5
 *         hasNextPage:
 *           type: boolean
 *         hasPrevPage:
 *           type: boolean
 *
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: integer
 *           description: HTTP status code
 *           example: 400
 *         message:
 *           type: string
 *           description: Error message
 *           example: Invalid request parameters
 *         data:
 *           type: object
 *           description: Additional error details
 */
