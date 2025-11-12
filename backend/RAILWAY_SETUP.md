# Railway Setup for SONAR Backend

## CRITICAL: Root Directory Configuration

⚠️ **DO NOT set a Root Directory in Railway settings!**

The backend depends on `@sonar/shared` which is in the parent monorepo. Railway must build from the **repository root**, not from `/backend`.

## Railway Configuration Steps

### 1. Remove Root Directory Setting

In Railway project settings:
- Go to your backend service → **Settings**
- Under **Source** section
- **Remove** or **leave blank** the "Root Directory" field
- Click **Save**

### 2. Railway will automatically:
- Use `backend/railway.json` for configuration
- Find `backend/Dockerfile` for build
- Build from repository root (accessing both `backend/` and `packages/shared/`)

### 3. Add Environment Variables

See main `backend/DEPLOYMENT.md` for the complete list.

## Why This Matters

```
Repository Structure:
/
├── packages/
│   └── shared/          ← Backend depends on this
├── backend/
│   ├── Dockerfile       ← Needs to access ../packages/shared
│   ├── railway.json
│   └── src/
```

If you set root to `/backend`:
- ❌ Docker can't access `../packages/shared`
- ❌ Build will fail with "workspace:* not supported"
- ❌ npm/bun can't resolve workspace dependencies

If you leave root **blank**:
- ✅ Builds from repository root
- ✅ Can access all workspace packages
- ✅ Uses `backend/Dockerfile` automatically

## Troubleshooting

### Error: "Unsupported URL Type workspace:*"
**Cause**: Railway root directory is set to `/backend`
**Fix**: Remove the root directory setting (leave blank)

### Error: "COPY ../packages/shared: forbidden path"
**Cause**: Docker trying to access parent directory
**Fix**: Remove the root directory setting in Railway

### Railway is using npm instead of Dockerfile
**Cause**: Auto-detection is running
**Fix**:
1. Ensure `backend/railway.json` exists
2. Remove root directory setting
3. Redeploy
