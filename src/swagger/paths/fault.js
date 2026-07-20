/**
 * @swagger
 * tags:
 *   - name: Faults
 *     description: Maintenance requests (segnalazioni)
 *
 * /faults:
 *   post:
 *     summary: Report a new fault
 *     description: >
 *       Multipart request — photos are uploaded under the `img` field
 *       (max 5 files, 5 MB each, JPEG/PNG/WebP/BMP) and stored on Cloudinary.
 *       `faultId` is a pre-generated human-readable code; fetch one from
 *       `GET /generate/id`.
 *     tags:
 *       - Faults
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - faultId
 *               - dataCreated
 *               - timeCreated
 *               - plantId
 *               - partId
 *               - comment
 *             properties:
 *               faultId:
 *                 type: string
 *                 pattern: '^SEG-\d{4}-\d{2}-\d{3}$'
 *                 example: SEG-2026-07-001
 *               dataCreated:
 *                 type: string
 *                 format: date
 *                 description: ISO date; must not be earlier than today
 *               timeCreated:
 *                 type: string
 *                 example: '14:32'
 *               plantId:
 *                 type: string
 *               partId:
 *                 type: string
 *               typeFault:
 *                 type: string
 *                 enum:
 *                   - Production
 *                   - Safety
 *                 default: Production
 *               comment:
 *                 type: string
 *                 minLength: 5
 *                 description: Problem description
 *               img:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Fault created
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
 *         description: Validation error, unsupported image type, or file too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *
 *   get:
 *     summary: List faults
 *     description: >
 *       Every filter is optional and they combine with AND. `plantId`,
 *       `partId` and `assignedMaintainers` come back populated.
 *     tags:
 *       - Faults
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
 *           maximum: 200
 *           default: 2
 *       - in: query
 *         name: search
 *         description: Partial case-insensitive match on faultId or nameOperator
 *         schema:
 *           type: string
 *       - in: query
 *         name: faultId
 *         schema:
 *           type: string
 *       - in: query
 *         name: nameOperator
 *         schema:
 *           type: string
 *       - in: query
 *         name: createdById
 *         description: Filter by the reporting operator
 *         schema:
 *           type: string
 *       - in: query
 *         name: plant
 *         schema:
 *           type: string
 *       - in: query
 *         name: partPlant
 *         schema:
 *           type: string
 *       - in: query
 *         name: typeFault
 *         schema:
 *           type: string
 *           enum:
 *             - Production
 *             - Safety
 *       - in: query
 *         name: statusFault
 *         description: >
 *           Single value or a comma-separated list, e.g.
 *           `In progress,Suspended,Overdue`
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum:
 *             - Low
 *             - Medium
 *             - High
 *       - in: query
 *         name: dataCreated
 *         schema:
 *           type: string
 *       - in: query
 *         name: deadline
 *         schema:
 *           type: string
 *       - in: query
 *         name: plannedDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         description: Faults assigned to this maintenance worker
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedToEmpty
 *         description: When true, returns only unassigned (pool) faults
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         description: Direction of the primary createdAt sort; asc = oldest first
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum:
 *             - faultId
 *             - nameOperator
 *             - userId
 *             - dataCreated
 *             - plantId
 *             - partId
 *             - typeFault
 *             - priority
 *             - deadline
 *             - plannedDate
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       200:
 *         description: Paginated fault list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 totalFault:
 *                   type: integer
 *                 totalPage:
 *                   type: integer
 *                 fault:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Invalid filter value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *
 * /faults/deadlines:
 *   get:
 *     summary: Aggregated per-day fault counts
 *     description: >
 *       Groups faults by day for calendar badges and the overdue heatmap,
 *       so the client does not have to fetch and count them itself.
 *       Aggregates on `plannedDate` or `deadline`.
 *     tags:
 *       - Faults
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         example: '2026-07-01'
 *       - in: query
 *         name: dateTo
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}-\d{2}$'
 *         example: '2026-07-31'
 *       - in: query
 *         name: field
 *         description: Which date field to aggregate on
 *         schema:
 *           type: string
 *           enum: [plannedDate, deadline]
 *           default: plannedDate
 *       - in: query
 *         name: statusFault
 *         description: Single value or comma-separated list
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [Low, Medium, High]
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedToEmpty
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: One entry per day that has at least one matching fault
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     example: '2026-07-14'
 *                   count:
 *                     type: integer
 *                     example: 3
 *                   byPriority:
 *                     type: object
 *                     properties:
 *                       Low:
 *                         type: integer
 *                       Medium:
 *                         type: integer
 *                       High:
 *                         type: integer
 *       400:
 *         description: Missing or malformed dateFrom / dateTo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *
 * /faults/{faultId}:
 *   get:
 *     summary: Get a single fault
 *     description: Returns the fault with plant, part and assigned maintainers populated.
 *     tags:
 *       - Faults
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: faultId
 *         required: true
 *         description: Mongo ObjectId, not the human-readable SEG-code
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The fault
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Invalid id format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /history/{faultId}:
 *   get:
 *     summary: Get the change history of a fault
 *     tags:
 *       - Faults
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
 *         description: Append-only history entries for the fault
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   action:
 *                     type: string
 *                     example: auto_overdue
 *                   userId:
 *                     type: string
 *                     nullable: true
 *                   userName:
 *                     type: string
 *                   changes:
 *                     type: object
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Fault not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
