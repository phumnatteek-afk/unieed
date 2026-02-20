import * as svc from "./auth.service.js";

export async function registerGeneral(req, res, next) {
  try {
    const result = await svc.registerGeneral(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function registerSchoolOneStep(req, res, next) {
  try {
    const result = await svc.registerSchoolOneStep(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const result = await svc.login(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function mySchoolStatus(req, res, next) {
  try {
    const result = await svc.getMySchoolStatus(req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function requestOtp(req, res, next) {
  try {
    const result = await svc.requestOtp(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const result = await svc.verifyOtp(req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

