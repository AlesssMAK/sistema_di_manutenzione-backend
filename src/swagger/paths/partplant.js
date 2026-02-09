/**
 * @swagger
 * /api/plants/parts:
 *   post:
 *     summary: Создание нового PartPlant (Admin only)
 *     tags:
 *       - PartPlants
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
 *               - namePartPlant
 *               - codePartPlant
 *               - location
 *             properties:
 *               plantId:
 *                 type: string
 *                 minLength: 4
 *                 example: PLANT_001
 *               namePartPlant:
 *                 type: string
 *                 minLength: 4
 *                 example: Engine Section
 *               codePartPlant:
 *                 type: string
 *                 minLength: 4
 *                 example: PART_001
 *               location:
 *                 type: string
 *                 minLength: 4
 *                 example: Milan
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Section responsible for engine assembly
 *     responses:
 *       201:
 *         description: PartPlant успешно создан
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
 *                   example: PartPlant created successfully
 *                 data:
 *                   $ref: '#/components/schemas/PartPlant'
 *       400:
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: PartPlant с таким именем или кодом уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
