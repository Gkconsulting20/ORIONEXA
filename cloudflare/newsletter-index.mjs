// Database records take precedence over bundled archives for the same issue.
export function mergeNewsletterIndexes(staticIndex, databaseIndex) {
  const byIssue = new Map();
  for (const item of [...staticIndex, ...databaseIndex]) {
    const issue = Number(item.issue);
    if (!Number.isSafeInteger(issue) || issue < 1) {
      throw new TypeError("Invalid newsletter issue");
    }
    byIssue.set(issue, { ...item, issue });
  }
  return [...byIssue.values()].sort((a, b) => b.issue - a.issue);
}
