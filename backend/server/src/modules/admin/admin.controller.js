import * as svc from "./admin.service.js";

export const listSchools = async (req, res, next) => {
  try { res.json(await svc.listSchools()); } catch (e) { next(e); }
};

export const getSchool = async (req, res, next) => {
  try { res.json(await svc.getSchool(req.params.id)); } catch (e) { next(e); }
};

export const approveSchool = async (req, res, next) => {
  try { res.json(await svc.approveSchool(req.params.id)); } catch (e) { next(e); }
};

export const rejectSchool = async (req, res, next) => {
  try { res.json(await svc.rejectSchool(req.params.id, req.body)); } catch (e) { next(e); }
};
