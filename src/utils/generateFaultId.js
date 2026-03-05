import { Fault } from '../models/fault.js';

const generateFaultId = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastFault = await Fault.findOne({
    faultId: { $regex: `^SEG-${year}-${month}-` },
  })
    .sort({ faultId: -1 })
    .lean();
  let nextNumber = 1;
  if (lastFault) {
    const lastId = lastFault.faultId;
    const lastNum = Number(lastId.split('-')[3]);
    nextNumber = lastNum + 1;
  }

  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `SEG-${year}-${month}-${paddedNumber}`;
};

export default generateFaultId;
