import type { GuardianFinding, GuardianReport, QaFinding, RiskLevel, SecurityFinding, WorkflowFinding } from "../core/types.js";

export type SarifLog = {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
};

type SarifRun = {
  tool: {
    driver: {
      name: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
};

type SarifRule = {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
  fullDescription: {
    text: string;
  };
  defaultConfiguration: {
    level: SarifLevel;
  };
  help?: {
    text: string;
  };
  properties: {
    tags: string[];
    precision: "medium";
    securitySeverity?: string;
  };
};

type SarifResult = {
  ruleId: string;
  level: SarifLevel;
  message: {
    text: string;
  };
  locations: SarifLocation[];
};

type SarifLocation = {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId: "%SRCROOT%";
    };
    region?: {
      startLine: number;
    };
  };
};

type SarifLevel = "note" | "warning" | "error";

const sarifSchemaUri = "https://json.schemastore.org/sarif-2.1.0.json";

export function renderSarifReport(report: GuardianReport): SarifLog {
  const findings = mappedFindings(report);

  return {
    $schema: sarifSchemaUri,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "AI Project Guardian",
            informationUri: "https://github.com",
            rules: uniqueRules(findings)
          }
        },
        results: findings.flatMap(toResults)
      }
    ]
  };
}

function mappedFindings(report: GuardianReport): Array<QaFinding | SecurityFinding | WorkflowFinding> {
  return [...report.qaFindings, ...report.securityFindings, ...report.workflowFindings];
}

function uniqueRules(findings: GuardianFinding[]): SarifRule[] {
  const rulesById = new Map<string, SarifRule>();

  for (const finding of findings) {
    if (!rulesById.has(finding.id)) {
      rulesById.set(finding.id, toRule(finding));
    }
  }

  return [...rulesById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function toRule(finding: GuardianFinding): SarifRule {
  return {
    id: finding.id,
    name: finding.title,
    shortDescription: {
      text: finding.title
    },
    fullDescription: {
      text: finding.description
    },
    defaultConfiguration: {
      level: toSarifLevel(finding.riskLevel)
    },
    ...(finding.recommendation === undefined ? {} : { help: { text: finding.recommendation } }),
    properties: {
      tags: ["ai-project-guardian", finding.area],
      precision: "medium",
      ...(finding.area === "security" ? { securitySeverity: toSecuritySeverity(finding.riskLevel) } : {})
    }
  };
}

function toResults(finding: QaFinding | SecurityFinding | WorkflowFinding): SarifResult[] {
  if (finding.area === "qa") {
    return finding.affectedFiles.map((path) => toResult(finding, path));
  }

  if (finding.area === "security") {
    return [toResult(finding, finding.filePath ?? "unknown", finding.lineNumber)];
  }

  return [toWorkflowResult(finding)];
}

function toResult(finding: QaFinding | SecurityFinding | WorkflowFinding, path: string, lineNumber?: number): SarifResult {
  return {
    ruleId: finding.id,
    level: toSarifLevel(finding.riskLevel),
    message: {
      text: messageText(finding)
    },
    locations: [toLocation(path, lineNumber)]
  };
}

function toWorkflowResult(finding: WorkflowFinding): SarifResult {
  return {
    ruleId: finding.id,
    level: toSarifLevel(finding.riskLevel),
    message: {
      text: messageText(finding)
    },
    locations: finding.workflowFile.split(",").map((path) => toLocation(path.trim()))
  };
}

function toLocation(path: string, lineNumber?: number): SarifLocation {
  return {
    physicalLocation: {
      artifactLocation: {
        uri: normalizeUri(path),
        uriBaseId: "%SRCROOT%"
      },
      ...(lineNumber === undefined ? {} : { region: { startLine: lineNumber } })
    }
  };
}

function messageText(finding: QaFinding | SecurityFinding | WorkflowFinding): string {
  if (finding.area === "workflow") {
    return `${finding.title}: ${finding.missingCheck}. ${finding.recommendation ?? finding.description}`;
  }

  if (finding.area === "qa") {
    return `${finding.title}. ${finding.suggestedTests.join(" ")}`;
  }

  return `${finding.title}. ${finding.recommendation ?? finding.description}`;
}

function toSarifLevel(riskLevel: RiskLevel): SarifLevel {
  if (riskLevel === "high" || riskLevel === "critical") {
    return "error";
  }

  if (riskLevel === "medium") {
    return "warning";
  }

  return "note";
}

function toSecuritySeverity(riskLevel: RiskLevel): string {
  const severities: Record<RiskLevel, string> = {
    info: "1.0",
    low: "3.0",
    medium: "5.0",
    high: "8.0",
    critical: "10.0"
  };

  return severities[riskLevel];
}

function normalizeUri(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
