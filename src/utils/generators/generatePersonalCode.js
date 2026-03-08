import { User } from '../../models/user.js';

const generatePersonalCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    const random = Math.floor(Math.random() * 99999) + 1;

    code = `OP${String(random).padStart(5, '0')}`;

    exists = await User.exists({ personalCode: code });
  }

  return code;
};

export default generatePersonalCode;
