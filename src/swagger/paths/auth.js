/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and session management
 *
 * /auth/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     description: >
 *       Operators authenticate with `fullName` + `personalCode` and must not
 *       carry a password; every other role authenticates with `email` +
 *       `password` and must not carry a personal code.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - fullName
 *               - email
 *             properties:
 *               role:
 *                 type: string
 *                 enum:
 *                   - operator
 *                   - admin
 *                   - manager
 *                   - maintenanceWorker
 *                   - safety
 *                 example: maintenanceWorker
 *               fullName:
 *                 type: string
 *                 description: At least two words, letters only
 *                 example: Mario Rossi
 *               email:
 *                 type: string
 *                 format: email
 *                 example: mario.rossi@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: >
 *                   Required for non-operator roles, forbidden for operators.
 *                   Must contain a lowercase, an uppercase and a special character.
 *                 example: Password!1
 *               personalCode:
 *                 type: string
 *                 pattern: '^[A-Z]{2}\d{5}$'
 *                 description: Required for operators, forbidden for other roles
 *                 example: OP00001
 *               avatar:
 *                 type: string
 *                 default: ''
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - deactivated
 *                 default: active
 *     responses:
 *       201:
 *         description: User created
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
 *                   example: User created successfully
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error, or email / personal code already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/login:
 *   post:
 *     summary: Log in and open a session
 *     description: >
 *       Accepts one of two mutually exclusive payloads. On success the opaque
 *       accessToken, refreshToken and sessionId are set as httpOnly cookies —
 *       they are not present in the response body.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 title: Operator login
 *                 required:
 *                   - fullName
 *                   - personalCode
 *                 properties:
 *                   fullName:
 *                     type: string
 *                     example: Mario Rossi
 *                   personalCode:
 *                     type: string
 *                     pattern: '^[A-Z]{2}\d{5}$'
 *                     example: OP00001
 *               - type: object
 *                 title: Email login
 *                 required:
 *                   - email
 *                   - password
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: mario.rossi@example.com
 *                   password:
 *                     type: string
 *                     example: Password!1
 *     responses:
 *       200:
 *         description: Session opened, cookies set
 *         headers:
 *           Set-Cookie:
 *             description: httpOnly accessToken (15 min), refreshToken (30 days), sessionId
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or wrong credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Account deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/refresh:
 *   post:
 *     summary: Rotate the session
 *     description: >
 *       Reads the `sessionId` and `refreshToken` cookies, issues a new token
 *       pair and sets the rotated cookies. Takes no request body.
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Session refreshed, rotated cookies set
 *       401:
 *         description: Session not found or refresh token expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/logout:
 *   post:
 *     summary: Close the current session
 *     description: Deletes the session document and clears the auth cookies.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       204:
 *         description: Session closed
 *
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     description: >
 *       Sends a link valid for one hour. Always answers 200 regardless of
 *       whether the address exists, to avoid account enumeration. Operators
 *       are excluded — they authenticate with a personal code.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: mario.rossi@example.com
 *     responses:
 *       200:
 *         description: Accepted — a link was sent if the address is eligible
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 * /auth/reset-password:
 *   post:
 *     summary: Set a new password using a reset token
 *     description: The token is single-use and expires one hour after issue.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Raw token taken from the emailed link
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain a lowercase, an uppercase and a special character
 *                 example: NewPassword!1
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Invalid, expired or already used token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
