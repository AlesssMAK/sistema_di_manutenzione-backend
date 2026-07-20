/**
 * @swagger
 * tags:
 *   - name: PlantParts
 *     description: Components belonging to a plant
 *
 * /plants/parts:
 *   post:
 *     summary: Create one or more parts for a plant (Admin only)
 *     description: >
 *       Takes a `plantId` plus an array of parts, so a whole machine can be
 *       described in a single call. Codes must be unique within the parent
 *       plant, but two different plants may reuse the same code.
 *     tags:
 *       - PlantParts
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plantId
 *               - parts
 *             properties:
 *               plantId:
 *                 type: string
 *                 example: 65a1b2c3d4e5f6a7b8c9d0e1
 *               parts:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - namePlantPart
 *                     - codePlantPart
 *                   properties:
 *                     namePlantPart:
 *                       type: string
 *                       example: Motore principale
 *                     codePlantPart:
 *                       type: string
 *                       example: MOT-01
 *                     status:
 *                       type: string
 *                       enum:
 *                         - active
 *                         - deactivated
 *                       default: active
 *     responses:
 *       201:
 *         description: Parts created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Plant parts created successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PlantPart'
 *       400:
 *         description: Validation error or invalid plantId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       409:
 *         description: A part with that code already exists in this plant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /plants/{plantId}/parts:
 *   get:
 *     summary: List the parts of a plant
 *     tags:
 *       - PlantParts
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plantId
 *         required: true
 *         description: 24-character hexadecimal ObjectId
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
 *           default: 12
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - active
 *             - deactivated
 *     responses:
 *       200:
 *         description: Paginated part list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     parts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PlantPart'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       400:
 *         description: plantId is not a valid 24-character hex id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *
 * /plants/{plantId}/parts/{plantPartId}:
 *   put:
 *     summary: Update a part (Admin only)
 *     tags:
 *       - PlantParts
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: plantPartId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Every field is optional; only those present are applied
 *             properties:
 *               namePlantPart:
 *                 type: string
 *               codePlantPart:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - deactivated
 *     responses:
 *       200:
 *         description: Part updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/PlantPart'
 *       400:
 *         description: Invalid id format or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Part not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Another part in this plant already uses that code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     summary: Deactivate a part (Admin only)
 *     description: Soft delete — sets `status` to `deactivated` and keeps the document.
 *     tags:
 *       - PlantParts
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plantId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: plantPartId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Part deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/PlantPart'
 *       400:
 *         description: Invalid id format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Part not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
