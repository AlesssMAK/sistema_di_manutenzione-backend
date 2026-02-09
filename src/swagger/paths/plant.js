/**
 * @swagger
 * /api/plants:
 *   post:
 *     summary: Создание нового plant (Admin only)
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
 *                 minLength: 4
 *                 example: Main Plant
 *               code:
 *                 type: string
 *                 minLength: 4
 *                 example: PLANT_001
 *               location:
 *                 type: string
 *                 minLength: 4
 *                 example: Milan
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Main production facility
 *     responses:
 *       201:
 *         description: Plant успешно создан
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
 *         description: Ошибка валидации
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Plant с таким именем или кодом уже существует
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   get:
 *     summary: Получить список всех plants
 *     tags:
 *       - Plants
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
 *           default: 12
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список plants с пагинацией
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
 *                     plants:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Plant'
 */
