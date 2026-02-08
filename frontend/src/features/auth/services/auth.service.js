import { request } from "../../../api/http.js";

export function registerGeneral(payload) {
  return request("/auth/register/general", { method: "POST", body: payload, auth: false });
}

export function registerSchoolOneStep(payload) {
  return request("/auth/register/school", { method: "POST", body: payload, auth: false });
}

export function login(payload) {
  return request("/auth/login", { method: "POST", body: payload, auth: false });
}
