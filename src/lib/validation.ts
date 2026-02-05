/**
 * Input validation utilities for tskills CLI
 * Validates user input before processing
 */

import { ValidationError } from './errors.js';

/**
 * Valid skill name pattern: lowercase letters, numbers, hyphens
 * Must start with a letter
 */
export const SKILL_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Valid username pattern: letters, numbers, underscores, hyphens
 * Must start with a letter
 */
export const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Valid org/team slug pattern: lowercase letters, numbers, hyphens
 * Must start with a letter
 */
export const ORG_SLUG_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Semver pattern (basic validation)
 */
export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

/**
 * Maximum allowed lengths
 */
export const MAX_LENGTHS = {
  skillName: 64,
  username: 39, // GitHub username limit
  orgSlug: 64,
  teamSlug: 64,
  description: 500,
  version: 32,
} as const;

/**
 * Validate a skill name
 * @throws ValidationError if invalid
 */
export function validateSkillName(name: string): void {
  if (!name) {
    throw new ValidationError('Skill name is required', 'name');
  }

  if (name.length > MAX_LENGTHS.skillName) {
    throw new ValidationError(
      `Skill name must be ${MAX_LENGTHS.skillName} characters or less`,
      'name'
    );
  }

  if (!SKILL_NAME_REGEX.test(name)) {
    throw new ValidationError(
      'Skill name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens',
      'name'
    );
  }

  // Reserved names (CLI subcommands + common reserved words)
  const reserved = [
    // Existing reserved words
    'new', 'create', 'delete', 'update', 'list', 'help',
    // CLI subcommands
    'login', 'logout', 'whoami', 'publish', 'install', 'uninstall',
    'search', 'info', 'org', 'team', 'outdated', 'deprecate',
    'sync', 'config', 'add', 'import', 'setup', 'init', 'share', 'invite',
    // Common reserved words
    'admin', 'api', 'www', 'app', 'registry',
    'undefined', 'null', 'true', 'false',
  ];
  if (reserved.includes(name)) {
    throw new ValidationError(
      `"${name}" is a reserved name and cannot be used`,
      'name'
    );
  }
}

/**
 * Validate a version string (semver format)
 * @throws ValidationError if invalid
 */
export function validateVersion(version: string): void {
  if (!version) {
    throw new ValidationError('Version is required', 'version');
  }

  if (version.length > MAX_LENGTHS.version) {
    throw new ValidationError(
      `Version must be ${MAX_LENGTHS.version} characters or less`,
      'version'
    );
  }

  if (!SEMVER_REGEX.test(version)) {
    throw new ValidationError(
      'Version must follow semver format (e.g., 1.0.0, 2.1.3-beta)',
      'version'
    );
  }
}

/**
 * Validate an organization slug
 * @throws ValidationError if invalid
 */
export function validateOrgSlug(slug: string): void {
  if (!slug) {
    throw new ValidationError('Organization slug is required', 'slug');
  }

  if (slug.length > MAX_LENGTHS.orgSlug) {
    throw new ValidationError(
      `Organization slug must be ${MAX_LENGTHS.orgSlug} characters or less`,
      'slug'
    );
  }

  if (!ORG_SLUG_REGEX.test(slug)) {
    throw new ValidationError(
      'Organization slug must be lowercase, start with a letter, and contain only letters, numbers, and hyphens',
      'slug'
    );
  }
}

/**
 * Validate a team slug
 * @throws ValidationError if invalid
 */
export function validateTeamSlug(slug: string): void {
  if (!slug) {
    throw new ValidationError('Team slug is required', 'slug');
  }

  if (slug.length > MAX_LENGTHS.teamSlug) {
    throw new ValidationError(
      `Team slug must be ${MAX_LENGTHS.teamSlug} characters or less`,
      'slug'
    );
  }

  if (!ORG_SLUG_REGEX.test(slug)) {
    throw new ValidationError(
      'Team slug must be lowercase, start with a letter, and contain only letters, numbers, and hyphens',
      'slug'
    );
  }
}

/**
 * Validate a username
 * @throws ValidationError if invalid
 */
export function validateUsername(username: string): void {
  if (!username) {
    throw new ValidationError('Username is required', 'username');
  }

  if (username.length > MAX_LENGTHS.username) {
    throw new ValidationError(
      `Username must be ${MAX_LENGTHS.username} characters or less`,
      'username'
    );
  }

  if (!USERNAME_REGEX.test(username)) {
    throw new ValidationError(
      'Username must start with a letter and contain only letters, numbers, underscores, and hyphens',
      'username'
    );
  }
}

/**
 * Parsed skill reference
 */
export interface ParsedSkillRef {
  owner: string;
  name: string;
  version?: string;
}

/**
 * Parse and validate a skill reference (owner/name or owner/name@version)
 * @throws ValidationError if invalid
 */
export function validateSkillRef(ref: string): ParsedSkillRef {
  if (!ref) {
    throw new ValidationError('Skill reference is required', 'skill');
  }

  // Check for version suffix
  const versionMatch = ref.match(/^(.+)@(.+)$/);
  const skillRef = versionMatch ? versionMatch[1] : ref;
  const version = versionMatch ? versionMatch[2] : undefined;

  // Split into owner/name
  const parts = skillRef.split('/');
  if (parts.length !== 2) {
    throw new ValidationError(
      'Invalid skill format. Use: owner/name or owner/name@version',
      'skill'
    );
  }

  const [owner, name] = parts;

  // Validate owner (could be username or org slug)
  if (!owner) {
    throw new ValidationError('Owner is required', 'owner');
  }

  // Use loose validation for owner since it could be username or org
  if (!USERNAME_REGEX.test(owner) && !ORG_SLUG_REGEX.test(owner)) {
    throw new ValidationError(
      'Invalid owner format. Must start with a letter and contain only letters, numbers, underscores, or hyphens',
      'owner'
    );
  }

  // Validate skill name
  validateSkillName(name);

  // Validate version if provided
  if (version) {
    validateVersion(version);
  }

  return { owner, name, version };
}

/**
 * Validate scope parameter
 * @throws ValidationError if invalid
 */
export function validateScope(scope: string): 'user' | 'project' {
  if (!scope) {
    throw new ValidationError('Scope is required', 'scope');
  }

  if (scope !== 'user' && scope !== 'project') {
    throw new ValidationError(
      'Scope must be "user" or "project"',
      'scope'
    );
  }

  return scope;
}

/**
 * Validate visibility parameter
 * @throws ValidationError if invalid
 */
export function validateVisibility(
  visibility: string
): 'public' | 'private' | 'org' | 'team' {
  const valid = ['public', 'private', 'org', 'team'];
  if (!valid.includes(visibility)) {
    throw new ValidationError(
      `Visibility must be one of: ${valid.join(', ')}`,
      'visibility'
    );
  }
  return visibility as 'public' | 'private' | 'org' | 'team';
}

/**
 * Validate description length
 * @throws ValidationError if too long
 */
export function validateDescription(description: string): void {
  if (description && description.length > MAX_LENGTHS.description) {
    throw new ValidationError(
      `Description must be ${MAX_LENGTHS.description} characters or less`,
      'description'
    );
  }
}
