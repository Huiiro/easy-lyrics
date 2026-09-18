import type { RecentProject } from './ipc'

export function parseRecentProjects(value: unknown): RecentProject[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const projects: RecentProject[] = []
  for (const item of value) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.path !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.lastOpenedAt !== 'number' ||
      !Number.isFinite(item.lastOpenedAt) ||
      seen.has(item.path)
    ) {
      continue
    }
    seen.add(item.path)
    projects.push({ path: item.path, name: item.name, lastOpenedAt: item.lastOpenedAt })
    if (projects.length === 10) break
  }
  return projects
}

export function prioritizeRecentProject(
  projects: RecentProject[],
  project: RecentProject
): RecentProject[] {
  return [project, ...projects.filter((item) => item.path !== project.path)].slice(0, 10)
}
