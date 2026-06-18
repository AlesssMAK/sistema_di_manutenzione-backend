import bcrypt from 'bcrypt';
import { User } from '../../src/models/user.js';
import { Plant } from '../../src/models/plant.js';
import { PlantPart } from '../../src/models/part.js';

const DEFAULT_PASSWORD = 'Test1234!';

let operatorSeq = 0;

/**
 * Create a user directly via the model so tests don't have to go
 * through the registration endpoint for every fixture. Returns the
 * created user and the plaintext password (operators get a
 * personalCode instead and don't have a password).
 */
export const createUser = async ({
  role,
  fullName,
  email,
  password = DEFAULT_PASSWORD,
  personalCode,
} = {}) => {
  if (!role) throw new Error('createUser: role is required');
  // Joi.email() defaults to the IANA TLD list and rejects '.local'
  // — use a real-looking TLD so the login validator accepts it.
  const finalEmail = email ?? `${role}-${Date.now()}@example.com`;
  const finalName = fullName ?? `${role} test`;

  const doc = {
    role,
    fullName: finalName,
    email: finalEmail,
    isFirstLogin: false,
  };

  if (role === 'operator') {
    operatorSeq += 1;
    doc.personalCode =
      personalCode ?? `OP${String(operatorSeq).padStart(5, '0')}`;
  } else {
    doc.password = await bcrypt.hash(password, 10);
  }

  const user = await User.create(doc);
  return { user, password };
};

export const createPlant = async (overrides = {}) =>
  Plant.create({
    namePlant: 'Linea Test',
    code: `PL-${Date.now()}`,
    location: 'Capannone Test',
    ...overrides,
  });

export const createPlantPart = async (plant, overrides = {}) =>
  PlantPart.create({
    plantId: plant._id,
    namePlantPart: 'Componente Test',
    codePlantPart: `CMP-${Date.now()}`,
    ...overrides,
  });
