import Constants from "expo-constants";

/**
 * Normalizes a semver string (e.g. "v1.3.2" -> "1.3.2") into numeric integer segments.
 */
export function parseSemVer(versionStr: string | null | undefined): number[] {
  if (!versionStr || typeof versionStr !== "string") {
    return [0, 0, 0];
  }
  const clean = versionStr.trim().replace(/^[vV]/, "").split("-")[0];
  const parts = clean.split(".").map((p) => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.slice(0, 3);
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemVer(
  v1: string | null | undefined,
  v2: string | null | undefined,
): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

/**
 * Returns the currently running app version string.
 * Defaults to "1.3.2" if not resolvable.
 */
export function getCurrentAppVersion(): string {
  try {
    const expoVer = Constants.expoConfig?.version;
    if (expoVer && typeof expoVer === "string" && expoVer.trim()) {
      return expoVer.trim();
    }
  } catch {}
  return "1.3.2";
}

export interface VersionGateEvaluation {
  hasUpdate: boolean;
  isMandatory: boolean;
  currentVersion: string;
  targetVersion: string;
  releaseTitle?: string;
  releaseNotes?: string;
  apkDownloadUrl?: string;
}

/**
 * Evaluates whether an update modal should be presented to the user.
 */
export function evaluateVersionGate(
  platformSettings:
    | {
        minSupportedVersion?: string;
        latestVersion?: string;
        forceUpdate?: boolean;
        releaseTitle?: string;
        releaseNotes?: string;
        apkDownloadUrl?: string;
      }
    | null
    | undefined,
): VersionGateEvaluation {
  const currentVersion = getCurrentAppVersion();
  const minSupported = (platformSettings?.minSupportedVersion || "").trim();
  const latest = (platformSettings?.latestVersion || "").trim();
  const forceUpdate = Boolean(platformSettings?.forceUpdate);

  // If no target version specified, no update gate needed
  if (!latest && !minSupported) {
    return {
      hasUpdate: false,
      isMandatory: false,
      currentVersion,
      targetVersion: currentVersion,
    };
  }

  const targetVersion = latest || minSupported || currentVersion;

  // Check if current version is below minimum supported
  const belowMinSupported = minSupported
    ? compareSemVer(currentVersion, minSupported) < 0
    : false;

  // Check if current version is below latest version
  const belowLatest = latest
    ? compareSemVer(currentVersion, latest) < 0
    : false;

  const hasUpdate = belowMinSupported || belowLatest;

  // Mandatory if:
  // 1. Below minimum supported version, OR
  // 2. forceUpdate flag is turned on in Super Admin and user is below latest version
  const isMandatory = belowMinSupported || (forceUpdate && belowLatest);

  return {
    hasUpdate,
    isMandatory,
    currentVersion,
    targetVersion,
    releaseTitle: platformSettings?.releaseTitle,
    releaseNotes: platformSettings?.releaseNotes,
    apkDownloadUrl: platformSettings?.apkDownloadUrl,
  };
}
