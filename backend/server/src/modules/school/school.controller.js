import { getSchoolMe } from "./school.service.js";

export async function schoolMe(req, res, next) {
  try {
    const user_id = req.user.user_id; // ต้องมาจาก middleware auth
    const me = await getSchoolMe(user_id);
    res.json(me);
  } 
  catch (err) {
    next(err);
  }
}

