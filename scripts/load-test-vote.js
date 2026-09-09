import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const API = __ENV.API_URL || 'http://localhost:4000';
const TOKEN = __ENV.AUTH_TOKEN || '';
const COMPANY_ID = __ENV.COMPANY_ID || '00000000-0000-0000-0000-000000000000';

export default function () {
  if (!TOKEN || COMPANY_ID === '00000000-0000-0000-0000-000000000000') {
    const res = http.get(`${API}/api/results/public`);
    check(res, {
      'public results ok': (r) => r.status === 200,
    });
    sleep(0.1);
    return;
  }

  const payload = JSON.stringify({
    companyId: COMPANY_ID,
    recaptchaToken: 'test-token',
  });

  const res = http.post(`${API}/api/vote`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  check(res, {
    'vote status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  sleep(0.05);
}
