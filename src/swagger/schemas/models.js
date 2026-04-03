/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - lastname
 *         - email
 *         - phone
 *         - password
 *         - role
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated user ID
 *           example: 64f0c2a9b9a1c2a1a1234567
 *         name:
 *           type: string
 *           description: User's first name
 *           example: John
 *         lastname:
 *           type: string
 *           description: User's last name
 *           example: Doe
 *         email:
 *           type: string
 *           format: email
 *           description: Unique email address
 *           example: john.doe@example.it
 *         phone:
 *           type: string
 *           description: Phone number in Italian format (+39XXXXXXXXXX)
 *           example: "+391234567890"
 *         city:
 *           type: string
 *           default: ""
 *           example: Rome
 *         avatar:
 *           type: string
 *           default: ""
 *           description: URL or string for avatar
 *           example: https://res.cloudinary.com/demo/image.jpg
 *         role:
 *           type: string
 *           enum:
 *             - operator
 *             - admin
 *             - manager
 *             - maintenanceWorker
 *             - safety
 *           default: operator
 *           description: User access level
 *           example: operator
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-02-09T12:00:00Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2026-02-09T12:00:00Z
 *
 *     Plant:
 *       type: object
 *       required:
 *         - namePlant
 *         - code
 *         - location
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated plant ID
 *           example: 65a1b2c3d4e5f6a7b8c9d0e1
 *         namePlant:
 *           type: string
 *           description: The name of the industrial plant
 *           example: Central Power Station
 *         code:
 *           type: string
 *           description: Unique plant code
 *           example: CPS-01
 *         location:
 *           type: string
 *           description: Geographical or physical location
 *           example: Milan, Sector B
 *         description:
 *           type: string
 *           description: Detailed plant description
 *           example: Main power generation facility for the northern region.
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PartPlant:
 *       type: object
 *       required:
 *         - plantId
 *         - namePartPlant
 *         - codePartPlant
 *         - location
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated part plant ID
 *           example: 65b2c3d4e5f6a7b8c9d0e1f2
 *         plantId:
 *           type: string
 *           description: Reference to the Plant ID
 *           example: 65a1b2c3d4e5f6a7b8c9d0e1
 *         namePartPlant:
 *           type: string
 *           minLength: 4
 *           description: Name of the specific plant part/sector
 *           example: Cooling Tower A
 *         codePartPlant:
 *           type: string
 *           minLength: 4
 *           description: Unique code for the part
 *           example: CTA-55
 *         location:
 *           type: string
 *           minLength: 4
 *           description: Specific location within the plant
 *           example: North Wing, Level 2
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description of the plant part
 *           example: Primary cooling system for turbine 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Fault:
 *       type: object
 *       description: Модель несправності обладнання
 *       properties:
 *         _id:
 *           type: string
 *           example: "65c12f8a9e1b2c0012a3b456"
 *         id_fault:
 *           type: string
 *           description: Унікальний ідентифікатор несправності
 *           example: "FAULT-2024-001"
 *         nameOperator:
 *           type: string
 *           description: Імʼя оператора, який зареєстрував несправність
 *           example: "Ivan Ivanov"
 *         userId:
 *           type: string
 *           description: ID оператора
 *           example: "65c12f8a9e1b2c0012a3b111"
 *         dataCreated:
 *           type: string
 *           description: Дата створення
 *           example: "2024-02-10"
 *         timeCreated:
 *           type: string
 *           description: Час створення
 *           example: "14:32"
 *         plantId:
 *           type: string
 *           description: ID обладнання (Plant)
 *           example: "64b1a2..."
 *         partId:
 *           type: string
 *           description: ID деталі обладнання (PartPlant)
 *           example: "64b1f5..."
 *         typeFault:
 *           type: string
 *           enum: [Produzione, Qualità, Manutenzione, Sicurezza]
 *           description: Тип несправності
 *           example: "Produzione"
 *         comment:
 *           type: string
 *           description: Опис проблеми
 *           example: "Не спрацьовує датчик тиску на основному валу"
 *         img:
 *           type: string
 *           description: Посилання на фото несправності
 *           example: "https://example.com/uploads/fault.jpg"
 *         priority:
 *           type: string
 *           enum: [Bassa, Media, Alta]
 *           description: Пріоритет виконання
 *           example: "Media"
 *         assignedMaintainers:
 *           type: array
 *           description: Список ID призначених монтерів
 *           items:
 *             type: string
 *         managerComment:
 *           type: string
 *           description: Коментар менеджера
 *           example: "Терміново перевірити вузол"
 *         deadline:
 *           type: string
 *           description: Дедлайн
 *           example: "2024-02-15"
 *         plannedDate:
 *           type: string
 *           description: Запланована дата
 *           example: "2024-02-12"
 *         plannedTime:
 *           type: string
 *           description: Запланований час
 *           example: "10:30"
 *         estimatedDuration:
 *           type: number
 *           description: Орієнтовна тривалість робіт (хв)
 *           example: 60
 *         managerId:
 *           type: string
 *           description: ID менеджера
 *           example: "65c12f8a9e1b2c0012a3b777"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     Session:
 *       type: object
 *       required:
 *         - userId
 *         - accessToken
 *         - refreshToken
 *         - accessTokenValidUntil
 *         - refreshTokenValidUntil
 *       properties:
 *         _id:
 *           type: string
 *           example: 65c3d4e5f6a7b8c9d0e1f2g3
 *         userId:
 *           type: string
 *           description: Reference to the User ID
 *           example: 64f0c2a9b9a1c2a1a1234567
 *         accessToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         refreshToken:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         accessTokenValidUntil:
 *           type: string
 *           format: date-time
 *         refreshTokenValidUntil:
 *           type: string
 *           format: date-time
 *
 *     Error:
 *       type: object
 *       properties:
 *         status:
 *           type: integer
 *           description: HTTP status code
 *           example: 400
 *         message:
 *           type: string
 *           description: Error message
 *           example: Invalid request parameters
 *         data:
 *           type: object
 *           description: Additional error details
 */
