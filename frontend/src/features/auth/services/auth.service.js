import { postJson } from "../../../api/http.js";

export function registerGeneral(payload) {
  return postJson("/auth/register/general", payload, false);
}

export function registerSchoolOneStep(payload) {
  return postJson("/auth/register/school", payload, false);
}

export function login(payload) {
  return postJson("/auth/login", payload, false);
}
