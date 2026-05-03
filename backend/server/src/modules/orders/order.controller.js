import { getOrderDetail, getMyOrders, confirmReceipt, cancelBuyerOrder } from "./order.service.js";

export const getMyOrdersHandler = async (req, res) => {
  try {
    res.json(await getMyOrders(req.user.user_id));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const getOrderDetailHandler = async (req, res) => {
  try {
    res.json(await getOrderDetail(Number(req.params.id), req.user.user_id));
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const confirmReceiptHandler = async (req, res) => {
  try {
    const result = await confirmReceipt(Number(req.params.id), req.user.user_id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

export const cancelOrderHandler = async (req, res) => {
  try {
    const result = await cancelBuyerOrder(Number(req.params.id), req.user.user_id);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};