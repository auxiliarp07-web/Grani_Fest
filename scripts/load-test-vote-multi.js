import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://localhost:4000';
const tokenData = JSON.parse(open(__ENV.TOKENS_FILE || './.k6-tokens.json'));
const TOKENS = tokenData.tokens;
const COMPANY_ID = tokenData.companyId;

export const options = {
  vus: 50,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const token = TOKENS[Math.floor(Math.random() * TOKENS.length)];

  const payload = JSON.stringify({
    companyId: COMPANY_ID,
    recaptchaToken: 'test-token',
  });

  const res = http.post(`${API}/api/vote`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  check(res, {
    'vote accepted or duplicate only': (r) => r.status === 200 || r.status === 409,
  });

  sleep(0.05);
}
