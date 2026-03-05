import { Fault } from '../models/fault.js';
import createHttpError from 'http-errors';

export const getHistoryFault = async (req, res) => {
  const { faultId } = req.params; // Предполагая, что в роуте :faultId

  // Находим неполадку и заполняем данные о пользователях в истории
  const fault = await Fault.findById(faultId)
    .select('history id_fault')
    .populate('history.userId', 'name role');

  if (!fault) {
    throw createHttpError(404, 'Fault not found');
  }

  // Возвращаем только массив истории, отсортированный от новых к старым
  const history = fault.history.sort((a, b) => b.timestamp - a.timestamp);

  return res.status(200).json({
    id_fault: fault.id_fault,
    history,
  });
};
