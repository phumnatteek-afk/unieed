import { getHomeData, getProjectsByProvince, getHighDemandProvinces } from "./home.service.js";

export async function home(req, res, next) {
  try {
    const data = await getHomeData();
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function projectsByProvince(req, res, next) {
  try {
    const province = String(req.query.province || "").trim();
    if (!province) return res.status(400).json({ message: "กรุณาระบุจังหวัด" });
    const projects = await getProjectsByProvince(province);
    return res.json({ projects });
  } catch (err) {
    next(err);
  }
}

export async function highDemandProvinces(req, res, next) {
  try {
    const exclude = String(req.query.exclude || "").trim();
    const limit   = Math.min(10, Math.max(1, Number(req.query.limit) || 3));
    const data = await getHighDemandProvinces(exclude, limit);
    return res.json({ provinces: data });
  } catch (err) {
    next(err);
  }
}
