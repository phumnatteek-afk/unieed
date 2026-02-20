import * as svc from "./admin.service.js";

export async function adminListSchools(req, res, next) {
  try {
    const { status = "", q = "", sort = "latest" } = req.query;
    const data = await svc.listSchools({ status, q, sort });
    res.json(data); // ✅ {stats, rows}
  } catch (e) {
    next(e);
  }
}

export async function adminApproveSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.approveSchool(id));
  } catch (e) {
    next(e);
  }
}

export async function adminRemoveSchool(req, res, next) {
  try {
    const id = Number(req.params.id);
    res.json(await svc.removeSchool(id));
  } catch (e) {
    next(e);
  }
}

export async function adminOverview(req, res, next) {
  try {
    const stats = await svc.getOverviewStats();
    res.json(stats);
  } catch (e) {
    next(e);
  }
}

export async function adminRejectSchool(req, res, next) {
  try {
    const school_id = Number(req.params.id);
    const note = String(req.body?.note || "").trim();
    const result = await svc.rejectSchool(school_id, note);
    res.json(result);
  } catch (e) {
    next(e);
  }
}


export async function getSchoolDetail(req, res, next) {
  try {
    const data = await svc.getSchoolDetail(req.params.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function updateSchool(req, res, next) {
  try {
    const data = await svc.updateSchool(req.params.id, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
}
export async function adminUpdateSchool(req, res, next) {
  try {
    const data = await svc.adminUpdateSchool(req.params.id, req.body);
    res.json(data);
  } catch (e) {
    next(e);
  }
}



