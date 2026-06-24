import { basename } from "node:path";
import type { ChangedFile } from "../core/types.js";

export type ReviewDomain = "auth" | "api" | "cli" | "workflow" | "config";

type DomainRule = {
  domain: ReviewDomain;
  strongPath: RegExp[];
  fileName: RegExp[];
  suggestions: string[];
};

const domainRules: DomainRule[] = [
  {
    domain: "auth",
    strongPath: [
      /(^|\/)(auth|authentication|authorization|oauth|login|password|sessions?|tokens?|jwt|permissions?|roles?)(\/|$)/i
    ],
    fileName: [/(^|[._-])(auth|oauth|login|password|session|token|jwt|permission|role)([._-]|$)/i],
    suggestions: ["happy path", "invalid credentials", "expired token", "unauthorized access", "permission denied"]
  },
  {
    domain: "api",
    strongPath: [/(^|\/)(api|apis|routes?|controllers?|handlers?|endpoints?)(\/|$)/i],
    fileName: [/(^|[._-])(api|route|routes|controller|handler|endpoint)([._-]|$)/i],
    suggestions: ["success response", "bad request", "unauthorized", "not found"]
  },
  {
    domain: "cli",
    strongPath: [/(^|\/)(cli|bin|commands?)(\/|$)/i],
    fileName: [/(^|[._-])(cli|command|args?|argv|init|run)([._-]|$)/i],
    suggestions: ["valid command", "invalid input", "output contract", "regression"]
  },
  {
    domain: "workflow",
    strongPath: [/(^|\/)\.github\/workflows\//i, /(^|\/)(workflows?|actions?)(\/|$)/i],
    fileName: [/(^|[._-])(workflow|action|ci|release|deploy)([._-]|$)|\.(ya?ml)$/i],
    suggestions: ["trigger behavior", "permissions", "artifact generation", "required checks"]
  },
  {
    domain: "config",
    strongPath: [
      /(^|\/)(config|configs?)(\/|$)/i,
      /(^|\/)(package|tsconfig|jsconfig|eslint\.config|vite\.config|webpack\.config|guardian\.config)\.[^/]+$/i
    ],
    fileName: [
      /(^|[._-])(config|settings|rc)([._-]|$)/i,
      /(^|\/)(package|tsconfig|jsconfig|eslint\.config|vite\.config|webpack\.config|guardian\.config)\.[^/]+$/i
    ],
    suggestions: ["clean install", "build", "test", "audit"]
  }
];

export function buildDomainCoverageSuggestions(changedFiles: ChangedFile[]): string[] {
  return detectReviewDomains(changedFiles).flatMap((domain) =>
    domainRules
      .find((rule) => rule.domain === domain)
      ?.suggestions.map((suggestion) => `${domain}: ${suggestion}`) ?? []
  );
}

export function detectReviewDomains(changedFiles: ChangedFile[]): ReviewDomain[] {
  const domains = new Set<ReviewDomain>();

  for (const file of changedFiles) {
    if (file.status === "deleted") {
      continue;
    }

    const path = normalizePath(file.path);
    const name = basename(path);

    for (const rule of domainRules) {
      if (domainConfidence(rule, path, name) >= 2) {
        domains.add(rule.domain);
      }
    }
  }

  return domainRules.map((rule) => rule.domain).filter((domain) => domains.has(domain));
}

function domainConfidence(rule: DomainRule, path: string, fileName: string): number {
  const strongPathScore = rule.strongPath.some((pattern) => pattern.test(path)) ? 2 : 0;
  const fileNameScore = rule.fileName.some((pattern) => pattern.test(fileName) || pattern.test(path)) ? 1 : 0;

  return strongPathScore + fileNameScore;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
