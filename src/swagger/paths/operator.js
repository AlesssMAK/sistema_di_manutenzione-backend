/**
 * @swagger
 * tags:
 *   name: Operator
 *   description: Ендпоїнти для роботи операторів
 */

/**
 * @swagger
 * /api/operator/fault:
 *   post:
 *     summary: Реєстрація нової несправності (Оператор)
 *     description: Створює запис про поломку з можливістю завантаження зображення. Потрібна авторизація.
 *     tags: [Operator]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - plantId
 *               - partId
 *               - typeFault
 *               - comment
 *             properties:
 *               plantId:
 *                 type: string
 *                 description: ID обладнання (Plant)
 *                 example: "64b1a2..."
 *               partId:
 *                 type: string
 *                 description: ID конкретної деталі (PartPlant)
 *                 example: "64b1f5..."
 *               typeFault:
 *                 type: string
 *                 enum: [Produzione, Qualità, Manutenzione, Sicurezza]
 *                 description: Тип несправності (з констант TYPE_FAULT)
 *               comment:
 *                 type: string
 *                 minLength: 5
 *                 description: Опис проблеми
 *                 example: "Не спрацьовує датчик тиску на основному валу"
 *               img:
 *                 type: string
 *                 format: binary
 *                 description: Фото несправності (завантажується через Multer)
 *     responses:
 *       201:
 *         description: Несправність успішно створена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fault'
 *       400:
 *         description: Помилка валідації (Celebrate) або деталь не належить цій машині
 *       401:
 *         description: Користувач не авторизований
 *       500:
 *         description: Помилка сервера під час збереження даних
 */

/**
 * @swagger
 * /api/operators:
 *   get:
 *     summary: Отримання списку всіх операторів
 *     description: Повертає список користувачів із роллю 'operator' (тільки поле name)
 *     tags: [Operator]
 *     responses:
 *       200:
 *         description: Список операторів успішно отримано
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 results:
 *                   type: integer
 *                   example: 10
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "64b1a..."
 *                       name:
 *                         type: string
 *                         example: "Ivan Ivanov"
 */
