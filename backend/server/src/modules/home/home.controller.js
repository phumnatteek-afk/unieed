import { getHomeData } from "./home.service.js";

export async function home(req, res, next) {
  try {
    const data = await getHomeData();
    return res.json(data);
  } catch (err) {
    next(err);
  }
}
