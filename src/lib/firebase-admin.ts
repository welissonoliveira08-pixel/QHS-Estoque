import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
        projectId?: unknown;
      };
      if (typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // Fallback to known Firebase project ID if config file is not traced into serverless bundle
  }
  return 'sylvan-throne-pbcxw';
}

if (!getApps().length) {
  initializeApp({
    projectId: resolveFirebaseProjectId(),
  });
}

export const adminAuth = getAuth();
