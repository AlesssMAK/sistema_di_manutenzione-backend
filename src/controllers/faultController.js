import { Fault } from '../models/fault.js';

export const createFault = async (req, res) => {
  try {
    const { plantId, partId, typefault, comment, img } = req.body;
    const nameOperator = req.user.name;

  }






};
