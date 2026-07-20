/**
 * @swagger
 * tags:
 *   - name: Manager
 *     description: Planning and assignment
 *   - name: MaintenanceWorker
 *     description: Executing assigned work
 *   - name: Safety
 *     description: HSE oversight
 *
 * /manager/fault:
 *   post:
 *     summary: Plan a fault (Manager)
 *     description: >
 *       Sets the schedule, deadline and assignees on an existing fault.
 *       `deadline` must be on or after `plannedDate`, and `plannedDate`
 *       cannot be in the past. An empty `assignedMaintainers` leaves the
 *       fault in the shared pool. Assignees are notified by email.
 *     tags:
 *       - Manager
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - faultId
 *               - plannedDate
 *               - plannedTime
 *               - deadline
 *               - estimatedDuration
 *             properties:
 *               faultId:
 *                 type: string
 *                 description: Mongo ObjectId of the fault to plan
 *               plannedDate:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 description: Today or later
 *                 example: '2026-07-22'
 *               plannedTime:
 *                 type: string
 *                 example: '10:30'
 *               deadline:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 description: On or after plannedDate
 *                 example: '2026-07-25'
 *               estimatedDuration:
 *                 type: number
 *                 minimum: 1
 *                 description: Minutes
 *                 example: 90
 *               assignedMaintainers:
 *                 type: array
 *                 items:
 *                   type: string
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High]
 *               typeFault:
 *                 type: string
 *                 enum: [Production, Safety]
 *                 default: Production
 *               managerComment:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Fault planned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Validation error, past plannedDate, or deadline before plannedDate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a manager
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /manager/fault/{faultId}/reassign:
 *   patch:
 *     summary: Replace the assignee list (Manager)
 *     description: >
 *       Send the complete new list — the server diffs it against the current
 *       one to work out who was added and who was removed, emailing each
 *       group accordingly. An empty array moves the fault back to the pool.
 *       The fault status is left untouched.
 *     tags:
 *       - Manager
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
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
 *               - assignedMaintainers
 *             properties:
 *               assignedMaintainers:
 *                 type: array
 *                 description: The full new list of assignees
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Assignees replaced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Invalid ids, or the list is unchanged
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a manager
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /manager/fault/{faultId}/add-maintainers:
 *   post:
 *     summary: Append assignees to a fault (Manager)
 *     description: >
 *       Append-only counterpart to reassign — send just the new people.
 *       Ids already on the fault are rejected, so the client does not have
 *       to compute the difference. Only the newly added are emailed.
 *     tags:
 *       - Manager
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
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
 *               - additionalMaintainers
 *             properties:
 *               additionalMaintainers:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Maintainers added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Empty list, invalid ids, or a maintainer already assigned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a manager
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /maintenance-worker:
 *   get:
 *     summary: List the faults visible to the current maintenance worker
 *     tags:
 *       - MaintenanceWorker
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Faults assigned to the caller
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Fault'
 *       401:
 *         description: Not authenticated
 *
 * /maintenance-worker/fault/{faultId}/claim:
 *   patch:
 *     summary: Claim a pool fault
 *     description: >
 *       Takes an unassigned fault, recording `claimedBy` and `claimedAt`
 *       and adding the caller to the assignees.
 *     tags:
 *       - MaintenanceWorker
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fault claimed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Invalid id, or the fault is already claimed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a maintenance worker
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /maintenance-worker/fault/{faultId}:
 *   patch:
 *     summary: Update the status of an assigned fault
 *     description: >
 *       Two fields are conditionally required: `actualDuration` when moving
 *       to `Completed`, and `suspensionReason` when moving to `Suspended`.
 *     tags:
 *       - MaintenanceWorker
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
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
 *               - statusFault
 *             properties:
 *               statusFault:
 *                 type: string
 *                 enum:
 *                   - Created
 *                   - In progress
 *                   - Completed
 *                   - Suspended
 *                   - Overdue
 *               commentMaintenanceWorker:
 *                 type: string
 *                 nullable: true
 *               actualDuration:
 *                 type: number
 *                 minimum: 1
 *                 description: Minutes; required when statusFault is `Completed`
 *               suspensionReason:
 *                 type: string
 *                 minLength: 3
 *                 description: Required when statusFault is `Suspended`
 *               materialRequest:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Fault updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Validation error or a missing conditional field
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not a maintenance worker
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /safety/fault/{faultId}:
 *   patch:
 *     summary: Set the HSE note on a fault (Safety)
 *     description: An empty string clears the note.
 *     tags:
 *       - Safety
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
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
 *               - commentSafety
 *             properties:
 *               commentSafety:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Note saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Invalid id or note longer than 2000 characters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an HSE user
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
