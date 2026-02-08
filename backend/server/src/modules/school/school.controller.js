import * as svc from "./school.service.js";

export const getMySchool = async (req, res, next) => {
  try { res.json(await svc.getMySchool(req.user)); }
  catch (e) { next(e); }
};
