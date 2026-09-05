const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const config = require('../config');

class Cloner {
  static validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, reason: 'URL must be a non-empty string' };
    }

    const trimmed = url.trim();

    // Check for fixture / local path
    if (trimmed.startsWith('fixture:') || trimmed.startsWith('local:')) {
      return { valid: true, isFixture: true, target: trimmed.replace(/^(fixture|local):/, '') };
    }

    // GitHub URL regex
    const githubRegex = /^https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(\.git)?\/?$/;
    const match = trimmed.match(githubRegex);
    if (!match) {
      return {
        valid: false,
        reason: 'Invalid GitHub URL format. Expected: https://github.com/owner/repository',
      };
    }

    return {
      valid: true,
      isFixture: false,
      owner: match[1],
      repoName: match[2].replace(/\.git$/, ''),
      cleanUrl: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, '')}.git`,
    };
  }

  static async cloneRepo(url, repoId) {
    const validation = this.validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const targetDir = path.join(config.scratchDir, 'repos', repoId.toString());

    // Ensure targetDir directory exists and is empty
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    if (validation.isFixture) {
      const fixturePath = path.isAbsolute(validation.target)
        ? validation.target
        : path.join(config.fixturesDir, validation.target);

      if (!fs.existsSync(fixturePath)) {
        throw new Error(`Fixture directory not found: ${fixturePath}`);
      }

      console.log(`[Cloner] Copying fixture from ${fixturePath} to ${targetDir}`);
      fs.cpSync(fixturePath, targetDir, { recursive: true });
      return {
        workspacePath: targetDir,
        name: path.basename(fixturePath),
        branch: 'local',
      };
    }

    console.log(`[Cloner] Cloning ${validation.cleanUrl} into ${targetDir}`);
    const git = simpleGit();
    await git.clone(validation.cleanUrl, targetDir, ['--depth', '1', '--single-branch']);

    return {
      workspacePath: targetDir,
      name: validation.repoName,
      branch: 'main',
    };
  }

  static cleanup(repoId) {
    const targetDir = path.join(config.scratchDir, 'repos', repoId.toString());
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log(`[Cloner] Cleaned up workspace: ${targetDir}`);
    }
  }
}

module.exports = Cloner;
