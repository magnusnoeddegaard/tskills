import matter from 'gray-matter';
import type { Skill, SkillFrontmatter } from '../types.js';

const DEFAULT_TOOLS = ['claude', 'cursor', 'copilot'];

export function parseSkill(content: string, filePath: string): Skill {
  const { data, content: body } = matter(content);
  const frontmatter = data as Partial<SkillFrontmatter>;

  if (!frontmatter.name) {
    throw new Error(`Skill at ${filePath} is missing required 'name' field`);
  }

  if (!frontmatter.description) {
    throw new Error(`Skill at ${filePath} is missing required 'description' field`);
  }

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tools: frontmatter.tools ?? DEFAULT_TOOLS,
    content: body.trim(),
    path: filePath,
  };
}

export function createSkillContent(name: string, description: string, content: string): string {
  return `---
name: ${name}
description: ${description}
---

${content}
`;
}

export function getSkillTemplate(name: string): string {
  return `---
name: ${name}
description: Describe when this skill should be used
---

# ${name}

Add your skill instructions here.

## Guidelines

- Guideline 1
- Guideline 2

## Examples

Provide examples if helpful.
`;
}
