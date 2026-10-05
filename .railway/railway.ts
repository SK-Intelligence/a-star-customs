// Railway Infrastructure as Code for project a-star-customs (ab0adfb4-474d-4bdd-a088-0bcec7faab62),
// environment production. Replaces the deprecated backend/railway.json and frontend/railway.json.
// Variables and secrets are deliberately NOT declared here: they stay managed in Railway.
// Both services and the backend volume run in EU West (Amsterdam), moved from sfo on 2026-10-05.
// Review with `railway config plan` before any `railway config apply` (see CONTRIBUTING.md).
import { defineRailway, github, project, service, volume } from "railway/iac";

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
    domains: ["astarcustoms.com"],
  });

  return project("a-star-customs", {
    resources: [backend, backendData, frontend],
  });
});
