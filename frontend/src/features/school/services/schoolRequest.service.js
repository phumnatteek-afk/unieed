import { request } from "../../../api/http.js";

export const schoolRequestSvc = {
  getUniformTypes() {
    return request("/school/uniform-types", { auth: true });
  },
  listStudents(requestId) {
    return request(`/school/projects/${requestId}/students`, { auth: true });
  },
  createStudent(requestId, payload) {
    return request(`/school/projects/${requestId}/students`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },
  updateStudent(requestId, studentId, payload) {
    return request(`/school/projects/${requestId}/students/${studentId}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },
  deleteStudent(requestId, studentId) {
    return request(`/school/projects/${requestId}/students/${studentId}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
