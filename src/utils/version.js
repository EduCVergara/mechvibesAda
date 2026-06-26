'use strict';

function extractVersion(...values) {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const match = value.match(/(?:^|[^\d])v?(\d+)\.(\d+)\.(\d+)(?=$|[^\d])/i);
    if (match) {
      return match.slice(1).map(Number);
    }
  }

  return null;
}

function isNewerVersion(candidate, current) {
  const candidateParts = Array.isArray(candidate) ? candidate : extractVersion(candidate);
  const currentParts = Array.isArray(current) ? current : extractVersion(current);

  if (candidateParts === null || currentParts === null) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index];
    }
  }

  return false;
}

module.exports = { extractVersion, isNewerVersion };
