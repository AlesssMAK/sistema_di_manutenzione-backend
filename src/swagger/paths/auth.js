/**
 * @swagger
 * tags:
 * - name: Auth
 * description: Эндпоинты для аутентификации и управления сессиями
 *
 * /api/auth/register:
 * post:
 * summary: Регистрация нового пользователя (Только для Admin)
 * tags: [Auth]
 * security:
 * - cookieAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - lastname
 * - email
 * - phone
 * - password
 * - role
 * properties:
 * name:
 * type: string
 * example: John
 * lastname:
 * type: string
 * example: Doe
 * email:
 * type: string
 * format: email
 * example: john.doe@example.it
 * phone:
 * type: string
 * example: "+391234567890"
 * password:
 * type: string
 * format: password
 * example: securePassword123
 * role:
 * type: string
 * enum: [operator, admin, manager, maintenanceWorker, safety]
 * example: operator
 * responses:
 * 201:
 * description: Пользователь успешно создан, сессия инициализирована
 * headers:
 * Set-Cookie:
 * description: Устанавливает sessionId и refreshToken
 * schema:
 * type: string
 * example: sessionId=...; refreshToken=...; HttpOnly;
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/User'
 * 400:
 * description: Ошибка валидации или данные уже используются
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * examples:
 * emailInUse:
 * summary: Email уже занят
 * value: { statusCode: 400, message: "Email address is already in use" }
 * phoneInUse:
 * summary: Телефон уже занят
 * value: { statusCode: 400, message: "Phone number is already in use" }
 *
 * /api/auth/login:
 * post:
 * summary: Вход в систему
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * format: email
 * example: john.doe@example.it
 * password:
 * type: string
 * format: password
 * example: securePassword123
 * responses:
 * 200:
 * description: Успешный вход
 * headers:
 * Set-Cookie:
 * schema:
 * type: string
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/User'
 * 401:
 * description: Неверные учетные данные
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * example:
 * statusCode: 401
 * message: Invalid credentials
 *
 * /api/auth/refresh:
 * post:
 * summary: Обновление сессии пользователя
 * tags: [Auth]
 * description: Использует куки sessionId и refreshToken для создания новой сессии
 * responses:
 * 200:
 * description: Сессия успешно обновлена
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * message:
 * type: string
 * example: Successfully refreshed a session
 * 401:
 * description: Сессия не найдена или истекла
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Error'
 * examples:
 * notFound:
 * summary: Сессия не найдена
 * value: { statusCode: 401, message: "Session not found" }
 * expired:
 * summary: Токен истек
 * value: { statusCode: 401, message: "Session token expired" }
 */
