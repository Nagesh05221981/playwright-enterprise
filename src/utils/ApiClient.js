import { TestLogger } from '../logging/index.js';

export class ApiClient {
  constructor(baseURL, request, testInfo) {
    this.baseURL = baseURL;
    this.request = request;
    this.token = null;
    this.logger = new TestLogger(testInfo?.title || 'api-client');
  }

  async authenticate(username, password) {
    this.logger.step(`Authenticating as "${username}"`);
    const start = Date.now();
    const response = await this.request.post(`${this.baseURL}/auth/login`, {
      data: { username, password },
    });
    const body = await response.json();
    this.token = body.token;
    this.logger.logRequest('POST', '/auth/login', response.status(), Date.now() - start);
    return body;
  }

  async get(endpoint) {
    const start = Date.now();
    const response = await this.request.get(`${this.baseURL}${endpoint}`, {
      headers: this._headers(),
    });
    const data = await response.json();
    this.logger.logRequest('GET', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data };
  }

  async post(endpoint, data) {
    const start = Date.now();
    const response = await this.request.post(`${this.baseURL}${endpoint}`, {
      data,
      headers: this._headers(),
    });
    const responseData = await response.json();
    this.logger.logRequest('POST', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data: responseData };
  }

  async put(endpoint, data) {
    const start = Date.now();
    const response = await this.request.put(`${this.baseURL}${endpoint}`, {
      data,
      headers: this._headers(),
    });
    const responseData = await response.json();
    this.logger.logRequest('PUT', endpoint, response.status(), Date.now() - start);
    return { status: response.status(), data: responseData };
  }

  async delete(endpoint) {
    const start = Date.now();
    const response = await this.request.delete(`${this.baseURL}${endpoint}`, {
      headers: this._headers(),
    });
    this.logger.logRequest('DELETE', endpoint, response.status(), Date.now() - start);
    return { status: response.status() };
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }
}
