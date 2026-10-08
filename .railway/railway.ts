// Railway Infrastructure as Code for project a-star-customs (ab0adfb4-474d-4bdd-a088-0bcec7faab62),
// environment production. Replaces the deprecated backend/railway.json and frontend/railway.json.
// Variable VALUES are never written here. Each existing variable is listed by name with preserve(),
// so applying this file keeps it exactly as set in Railway and never deletes it.
// Both services and the backend volume run in EU West (Amsterdam), moved from sfo on 2026-10-05.
// Review with `railway config plan` before any `railway config apply` (see CONTRIBUTING.md).
import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const backendData = volume("backend-volume", {
    region: "europe-west4-drams3a",
    sizeMB: 500,
  });

  const backend = service("backend", {
    // checkSuites is Railway's "Wait for CI": deploy a commit only after its check suites pass.
    source: github("SK-Intelligence/a-star-customs", { branch: "main", checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "backend/Dockerfile",
      watchPatterns: ["backend/**"],
    },
    regions: { "europe-west4-drams3a": 1 },
    variables: {
      CHECKOUT_CANCEL_URL: preserve(),
      CHECKOUT_SUCCESS_URL: preserve(),
      CORS_ORIGINS: preserve(),
      ORDERS_DATABASE_PATH: preserve(),
      PORT: preserve(),
      RAILWAY_RUN_UID: preserve(),
      REVIEWS_DATABASE_PATH: preserve(),
      STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    volumeMounts: {
      "/data": backendData,
    },
  });

  const frontend = service("frontend", {
    source: github("SK-Intelligence/a-star-customs", { branch: "main", checkSuites: true }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "frontend/Dockerfile",
    },
    regions: { "europe-west4-drams3a": 1 },
    variables: {
      BACKEND_HOST: preserve(),
      NGINX_ENVSUBST_FILTER: preserve(),
      NGINX_RESOLVER: preserve(),
      PORT: preserve(),
    },
    domains: ["astarcustoms.com"],
  });

  return project("a-star-customs", {
    resources: [backend, backendData, frontend],
  });
});
