/**
 * @swagger
 * /api/users/{userId}:
 *   patch:
 *     summary: Частичное обновление профиля пользователя (Admin only)
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID пользователя, которого нужно обновить
 *     requestBody:
 *       description: Объект с полями для обновления. Можно отправить только те поля, которые нужно изменить.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John
 *               lastname:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: new-email@example.it
 *               phone:
 *                 type: string
 *                 example: "+391234567890"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: newSecurePassword123
 *               city:
 *                 type: string
 *                 example: Milan
 *               avatar:
 *                 type: string
 *                 example: https://example.com/new-avatar.jpg
 *               role:
 *                 type: string
 *                 enum:
 *                   - operator
 *                   - admin
 *                   - manager
 *                   - maintenanceWorker
 *                   - safety
 *                 example: manager
 *     responses:
 *       200:
 *         description: Пользователь успешно обновлен
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
 *                   example: User updated by admin successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Тело запроса пустое или данные невалидны
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Пользователь с таким ID не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   put:
 *     summary: Полное обновление профиля пользователя (Admin only)
 *     description: В данной реализации работает идентично PATCH
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/requestBodies/UserUpdate'
 *     responses:
 *       200:
 *         description: Пользователь успешно обновлен
 */
