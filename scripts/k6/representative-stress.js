import http from 'k6/http';
import { check, fail } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SESSION_COOKIE_NAME = __ENV.SESSION_COOKIE_NAME || 'karirkit_session';
const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const SUMMARY_JSON = __ENV.SUMMARY_JSON || 'k6-summary.json';
const PRESET = (__ENV.PRESET || 'custom').toLowerCase();

const presetConfig = {
  smoke: {
    totalStartRps: 2,
    totalMaxRps: 20,
    totalStepRps: 2,
    stepDuration: '30s',
    holdDuration: '1m',
    rampDownDuration: '15s',
    p95Ms: 1200,
    maxErrorRate: 0.02,
  },
  stress: {
    totalStartRps: 10,
    totalMaxRps: 150,
    totalStepRps: 10,
    stepDuration: '1m',
    holdDuration: '2m',
    rampDownDuration: '30s',
    p95Ms: 1000,
    maxErrorRate: 0.05,
  },
  breakpoint: {
    totalStartRps: 20,
    totalMaxRps: 400,
    totalStepRps: 20,
    stepDuration: '45s',
    holdDuration: '90s',
    rampDownDuration: '20s',
    p95Ms: 1500,
    maxErrorRate: 0.1,
  },
};

const selectedPreset = presetConfig[PRESET] || null;

const TOTAL_START_RPS = toInt(__ENV.TOTAL_START_RPS, selectedPreset?.totalStartRps ?? 10);
const TOTAL_MAX_RPS = toInt(__ENV.TOTAL_MAX_RPS, selectedPreset?.totalMaxRps ?? 150);
const TOTAL_STEP_RPS = toInt(__ENV.TOTAL_STEP_RPS, selectedPreset?.totalStepRps ?? 10);
const STEP_DURATION = __ENV.STEP_DURATION || selectedPreset?.stepDuration || '1m';
const HOLD_DURATION = __ENV.HOLD_DURATION || selectedPreset?.holdDuration || '2m';
const RAMP_DOWN_DURATION =
  __ENV.RAMP_DOWN_DURATION || selectedPreset?.rampDownDuration || '30s';
const P95_MS = toInt(__ENV.P95_MS, selectedPreset?.p95Ms ?? 1000);
const MAX_ERROR_RATE = toFloat(__ENV.MAX_ERROR_RATE, selectedPreset?.maxErrorRate ?? 0.05);
const VU_BUFFER_FACTOR = toFloat(__ENV.VU_BUFFER_FACTOR, 0.5);
const MAX_VU_FACTOR = toFloat(__ENV.MAX_VU_FACTOR, 2.0);
const SCENARIO = __ENV.SCENARIO || '';

const userAuthConfigured = Boolean(
  __ENV.USER_BEARER_TOKEN ||
    __ENV.USER_COOKIE ||
    (__ENV.USER_EMAIL && __ENV.USER_PASSWORD)
);

const adminAuthConfigured = Boolean(
  __ENV.ADMIN_BEARER_TOKEN ||
    __ENV.ADMIN_COOKIE ||
    (__ENV.ADMIN_EMAIL && __ENV.ADMIN_PASSWORD)
);

const allScenarioDefinitions = [
  {
    name: 'health_public',
    exec: 'healthPublic',
    weight: 0.1,
    auth: 'none',
    thresholdMs: 300,
  },
  {
    name: 'stats_public',
    exec: 'statsPublic',
    weight: 0.15,
    auth: 'none',
    thresholdMs: 750,
  },
  {
    name: 'templates_public',
    exec: 'templatesPublic',
    weight: 0.2,
    auth: 'none',
    thresholdMs: 1000,
  },
  {
    name: 'jobs_public',
    exec: 'jobsPublic',
    weight: 0.25,
    auth: 'none',
    thresholdMs: 1250,
  },
  {
    name: 'dashboard_user',
    exec: 'dashboardUser',
    weight: 0.15,
    auth: 'user',
    thresholdMs: 1250,
  },
  {
    name: 'subscription_user',
    exec: 'subscriptionUser',
    weight: 0.1,
    auth: 'user',
    thresholdMs: 1000,
  },
  {
    name: 'admin_dashboard',
    exec: 'adminDashboard',
    weight: 0.05,
    auth: 'admin',
    thresholdMs: 1500,
  },
];

const enabledScenarioDefinitions = allScenarioDefinitions.filter((definition) => {
  if (definition.auth === 'user') {
    return userAuthConfigured;
  }
  if (definition.auth === 'admin') {
    return adminAuthConfigured;
  }
  return true;
});

if (enabledScenarioDefinitions.length === 0) {
  throw new Error('No k6 scenarios are enabled. Configure BASE_URL and optional auth env vars.');
}

if (PRESET !== 'custom' && !selectedPreset) {
  throw new Error(`Unknown PRESET "${PRESET}". Use smoke, stress, breakpoint, or custom.`);
}

if (SCENARIO) {
  const selected = allScenarioDefinitions.find((definition) => definition.name === SCENARIO);
  if (!selected) {
    throw new Error(`Unknown SCENARIO "${SCENARIO}".`);
  }
  if (selected.auth === 'user' && !userAuthConfigured) {
    throw new Error(`SCENARIO "${SCENARIO}" requires USER_* auth configuration.`);
  }
  if (selected.auth === 'admin' && !adminAuthConfigured) {
    throw new Error(`SCENARIO "${SCENARIO}" requires ADMIN_* auth configuration.`);
  }
}

const activeScenarioDefinitions = SCENARIO
  ? enabledScenarioDefinitions.filter((definition) => definition.name === SCENARIO)
  : enabledScenarioDefinitions;

const totalWeight = activeScenarioDefinitions.reduce((sum, definition) => {
  return sum + definition.weight;
}, 0);

function toInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildStages(weightShare) {
  const stages = [];
  const startTarget = Math.round(TOTAL_START_RPS * weightShare);
  const maxTarget = Math.max(startTarget, Math.round(TOTAL_MAX_RPS * weightShare));
  const stepTarget = Math.max(1, Math.round(TOTAL_STEP_RPS * weightShare));

  if (startTarget > 0) {
    stages.push({ target: startTarget, duration: STEP_DURATION });
  }

  let currentTarget = startTarget;
  while (currentTarget + stepTarget < maxTarget) {
    currentTarget += stepTarget;
    stages.push({ target: currentTarget, duration: STEP_DURATION });
  }

  if (maxTarget > 0) {
    stages.push({ target: maxTarget, duration: HOLD_DURATION });
  }

  stages.push({ target: 0, duration: RAMP_DOWN_DURATION });
  return stages;
}

function buildScenarioConfig(definition) {
  const weightShare = definition.weight / totalWeight;
  const maxRate = Math.max(1, Math.round(TOTAL_MAX_RPS * weightShare));
  const preAllocatedVUs = Math.max(2, Math.ceil(maxRate * VU_BUFFER_FACTOR));
  const maxVUs = Math.max(preAllocatedVUs + 2, Math.ceil(maxRate * MAX_VU_FACTOR));

  return {
    executor: 'ramping-arrival-rate',
    exec: definition.exec,
    startRate: Math.max(0, Math.round(TOTAL_START_RPS * weightShare)),
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    gracefulStop: '0s',
    stages: buildStages(weightShare),
    tags: {
      endpoint: definition.name,
      auth: definition.auth,
    },
  };
}

const scenarios = activeScenarioDefinitions.reduce((accumulator, definition) => {
  accumulator[definition.name] = buildScenarioConfig(definition);
  return accumulator;
}, {});

const thresholds = {
  checks: ['rate>0.99'],
  http_req_failed: [`rate<${MAX_ERROR_RATE}`],
};

for (const definition of activeScenarioDefinitions) {
  thresholds[`http_req_duration{scenario:${definition.name}}`] = [
    `p(95)<${definition.thresholdMs || P95_MS}`,
  ];
}

export const options = {
  discardResponseBodies: true,
  scenarios,
  thresholds,
};

function extractCookieHeader(response, cookieName) {
  const setCookieHeader = response.headers['Set-Cookie'] || response.headers['set-cookie'];
  if (!setCookieHeader) {
    return null;
  }

  const candidates = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : String(setCookieHeader).split(/,(?=\s*[A-Za-z0-9_\-]+=)/);

  const pattern = new RegExp(`${cookieName}=([^;]+)`);
  for (const candidate of candidates) {
    const match = String(candidate).match(pattern);
    if (match) {
      return `${cookieName}=${match[1]}`;
    }
  }

  return null;
}

function loginAndGetCookie(email, password, label) {
  const response = http.post(
    `${BASE_URL}${LOGIN_PATH}`,
    JSON.stringify({
      identifier: email,
      password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: `${label}_login_setup`, phase: 'setup' },
    }
  );

  const ok = check(response, {
    [`${label} setup login status is 200`]: (res) => res.status === 200,
  });

  if (!ok) {
    fail(`${label} setup login failed with status ${response.status}`);
  }

  const cookieHeader = extractCookieHeader(response, SESSION_COOKIE_NAME);
  if (!cookieHeader) {
    fail(`${label} setup login did not return ${SESSION_COOKIE_NAME} cookie`);
  }

  return {
    headers: {
      Cookie: cookieHeader,
    },
  };
}

function resolveAuthContext(prefix, label) {
  const bearerToken = __ENV[`${prefix}_BEARER_TOKEN`];
  if (bearerToken) {
    return {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    };
  }

  const cookieHeader = __ENV[`${prefix}_COOKIE`];
  if (cookieHeader) {
    return {
      headers: {
        Cookie: cookieHeader,
      },
    };
  }

  const email = __ENV[`${prefix}_EMAIL`];
  const password = __ENV[`${prefix}_PASSWORD`];
  if (email && password) {
    return loginAndGetCookie(email, password, label);
  }

  return { headers: {} };
}

export function setup() {
  return {
    user: userAuthConfigured ? resolveAuthContext('USER', 'user') : { headers: {} },
    admin: adminAuthConfigured ? resolveAuthContext('ADMIN', 'admin') : { headers: {} },
  };
}

function requestJson(url, params, expectedStatus, label) {
  const response = http.get(url, params);
  check(response, {
    [`${label} status is ${expectedStatus}`]: (res) => res.status === expectedStatus,
  });
  return response;
}

function withTags(endpoint, extraHeaders) {
  return {
    headers: extraHeaders || {},
    tags: { endpoint },
  };
}

export function healthPublic() {
  requestJson(`${BASE_URL}/health`, withTags('health_public'), 200, 'health_public');
}

export function statsPublic() {
  requestJson(`${BASE_URL}/stats`, withTags('stats_public'), 200, 'stats_public');
}

export function templatesPublic() {
  requestJson(
    `${BASE_URL}/templates?type=cv&language=id`,
    withTags('templates_public'),
    200,
    'templates_public'
  );
}

export function jobsPublic() {
  requestJson(
    `${BASE_URL}/jobs?page=1&per_page=12`,
    withTags('jobs_public'),
    200,
    'jobs_public'
  );
}

export function dashboardUser(data) {
  requestJson(
    `${BASE_URL}/dashboard`,
    withTags('dashboard_user', data.user.headers),
    200,
    'dashboard_user'
  );
}

export function subscriptionUser(data) {
  requestJson(
    `${BASE_URL}/subscriptions/my`,
    withTags('subscription_user', data.user.headers),
    200,
    'subscription_user'
  );
}

export function adminDashboard(data) {
  requestJson(
    `${BASE_URL}/admin/dashboard`,
    withTags('admin_dashboard', data.admin.headers),
    200,
    'admin_dashboard'
  );
}

export function handleSummary(data) {
  const httpReqs = data.metrics.http_reqs?.values?.count || 0;
  const durationSeconds = data.state?.testRunDurationMs
    ? data.state.testRunDurationMs / 1000
    : 0;
  const achievedRps = durationSeconds > 0 ? httpReqs / durationSeconds : 0;

  data.root_group = data.root_group || {};
  data.root_group.checks = data.root_group.checks || [];

  const header = [
    '',
    'Representative API stress test summary',
    `base_url=${BASE_URL}`,
    `preset=${PRESET}`,
    `scenarios=${activeScenarioDefinitions.map((definition) => definition.name).join(',')}`,
    `achieved_http_rps=${achievedRps.toFixed(2)}`,
    `max_target_rps=${TOTAL_MAX_RPS}`,
    '',
  ].join('\n');

  return {
    stdout: `${header}${textSummary(data, { indent: ' ', enableColors: true })}`,
    [SUMMARY_JSON]: JSON.stringify(
      {
        baseUrl: BASE_URL,
        scenarios: activeScenarioDefinitions.map((definition) => definition.name),
        achievedHttpRps: achievedRps,
        totalHttpRequests: httpReqs,
        durationSeconds,
        summary: data,
      },
      null,
      2
    ),
  };
}
