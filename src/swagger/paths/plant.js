/**
 * @swagger
 * tags:
 *   - name: Plants
 *     description: Machines and production lines
 *
 * /plants:
 *   post:
 *     summary: Create a plant (Admin only)
 *     tags:
 *       - Plants
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - namePlant
 *               - code
 *               - location
 *             properties:
 *               namePlant:
 *                 type: string
 *                 example: Linea Estrusione 1
 *               code:
 *                 type: string
 *                 example: EXT-01
 *               location:
 *                 type: string
 *                 example: Reparto Nord
 *               description:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - deactivated
 *                 default: active
 *     responses:
 *       201:
 *         description: Plant created
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
 *                   example: Plant created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Plant'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       409:
 *         description: A plant with that name or code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   get:
 *     summary: List plants
 *     description: Returns both active and deactivated plants.
 *     tags:
 *       - Plants
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
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated plant list
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
 *                   example: Get all plants endpoint
 *                 data:
 *                   type: object
 *                   properties:
 *                     plants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Plant'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /plants/{plantId}:
 *   put:
 *     summary: Update a plant (Admin only)
 *     tags:
 *       - Plants
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plantId
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
 *               namePlant:
 *                 type: string
 *               code:
 *                 type: string
 *               location:
 *                 type: string
 *               description:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - deactivated
 *     responses:
 *       200:
 *         description: Plant updated
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
 *                   $ref: '#/components/schemas/Plant'
 *       400:
 *         description: Invalid id format or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Plant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   delete:
 *     summary: Deactivate a plant (Admin only)
 *     description: >
 *       Soft delete — the plant's `status` becomes `deactivated` and the
 *       document is kept. Its parts are left untouched and are not cascaded.
 *     tags:
 *       - Plants
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: plantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plant deactivated
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
 *                   $ref: '#/components/schemas/Plant'
 *       400:
 *         description: Invalid id format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Plant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
