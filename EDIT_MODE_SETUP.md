# TPS Agent Ecosystem - Edit Mode Setup Guide

## Overview
The TPS Agent Ecosystem now includes a full inline editing capability, allowing you to add, edit, and delete agents and sections directly through the UI. All changes are persisted to Vercel Blob Storage.

## Environment Variables Required

### 1. BASIC_AUTH_PASSWORD
- **Purpose**: Protects the entire application with HTTP Basic Authentication
- **Already configured**: ✅ (existing from middleware.js)
- **Location**: Set in Vercel Dashboard → Project Settings → Environment Variables

### 2. BLOB_READ_WRITE_TOKEN
- **Purpose**: Enables reading and writing to Vercel Blob Storage for config persistence
- **Status**: ⚠️ **REQUIRED - Must be configured**
- **How to set up**:

#### Step 1: Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

#### Step 2: Link your project (if not already linked)
```bash
vercel link
```

#### Step 3: Generate a Blob Read/Write Token
Go to your Vercel Dashboard:
1. Navigate to your project
2. Go to **Storage** → **Blob**
3. Create a new Blob store (if you don't have one)
4. Click **Create Token**
5. Select **Read and Write** permissions
6. Copy the generated token

#### Step 4: Add to Environment Variables
In Vercel Dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add new variable:
   - **Name**: `BLOB_READ_WRITE_TOKEN`
   - **Value**: [paste the token from step 3]
   - **Environments**: Select Production, Preview, and Development

#### Step 5: Redeploy
After adding the environment variable, redeploy your application:
```bash
vercel --prod
```

## First-Time Migration

When you first deploy the edit functionality, the configuration is still in the static `data/config.yaml` file. You need to migrate it to Blob Storage:

### Automatic Migration
The `/api/config` endpoint will automatically fall back to the static file if no blob exists yet. The first time you save any change, it will be written to Blob Storage.

### Manual Migration (Optional)
You can also manually trigger migration by making a POST request to `/api/migrate`:

```bash
curl -X POST https://your-app.vercel.app/api/migrate \
  -u "username:your-basic-auth-password"
```

This will copy the current `data/config.yaml` to Blob Storage.

## How to Use Edit Mode

### 1. Enable Edit Mode
- After logging in, you'll see an **"Enable Edit Mode"** button in the header
- Click it to activate edit mode
- All edit buttons will become visible

### 2. Edit an Agent
- Click the **"Edit"** button on any agent card
- Modal opens with all agent fields
- Modify any field, including:
  - Name, Objective, Description
  - Tools (checkbox selection)
  - Journey Steps (add/remove)
  - Metrics
- Click **"Save"** to persist changes
- Click **"Delete"** to remove the agent (with confirmation)

### 3. Edit a Section (Group)
- Click **"Edit Section"** on any group header
- Modify:
  - Section name, ID, CSS class
  - Color (color picker)
  - Phase image path
  - Flow diagram settings
- Click **"Save"** to persist

### 4. Add New Agent
- In edit mode, each section has an **"Add Agent"** button
- Click it to open the modal
- Fill in all agent fields
- Save to add to that section

### 5. Add New Section
- At the bottom of the page in edit mode: **"Add New Section"** button
- Click to create a new agent group
- Fill in all section details
- Save to add to the application

## Architecture

### API Endpoints

#### GET /api/config
- Fetches configuration from Blob Storage
- Falls back to static `data/config.yaml` if blob doesn't exist
- Returns YAML text
- Protected by Basic Auth

#### POST /api/config
- Saves configuration to Blob Storage
- Accepts YAML text in request body
- Overwrites existing blob
- Protected by Basic Auth

#### POST /api/migrate
- One-time migration endpoint
- Copies static `data/config.yaml` to Blob Storage
- Useful for initial setup
- Protected by Basic Auth

### Data Flow

```
User Interface
     ↓
  Edit Mode Activated
     ↓
  User makes changes
     ↓
  configData object updated in memory
     ↓
  saveConfig() converts to YAML
     ↓
  POST /api/config
     ↓
  Vercel Blob Storage (persisted)
     ↓
  Re-render UI with updated data
```

### Storage Priority
1. **First**: Check Blob Storage
2. **Fallback**: Use static `data/config.yaml`
3. **On save**: Always write to Blob Storage

## Styling Guidelines

All edit UI components follow the design system in `CLAUDE.md`:

- **Interactive Teal** (#17a2b8) - Edit buttons, hover states
- **Sales Red** (#e74c3c) - Delete buttons, exit edit mode
- Consistent hover effects with transform and shadow
- Lucide icons throughout
- Modal overlays with backdrop blur

## Security

### Authentication
- Same HTTP Basic Auth as main application
- API routes check `BASIC_AUTH_PASSWORD` env var
- Unauthorized requests return 401

### Authorization
- All users with valid password can edit
- No granular permissions (all-or-nothing access)
- Consider adding role-based access if needed

## Troubleshooting

### "Failed to save configuration" error
- Check that `BLOB_READ_WRITE_TOKEN` is set correctly
- Verify token has Read and Write permissions
- Check Vercel logs for detailed error messages

### Edit Mode button doesn't appear
- Authentication successful? (you should be logged in)
- Check browser console for JavaScript errors
- Verify `showEditModeButton()` is called in `loadAgents()`

### Changes don't persist
- Verify `BLOB_READ_WRITE_TOKEN` is configured
- Check network tab for failed POST to `/api/config`
- Look for error alerts in the UI

### Blob Storage not created
- Go to Vercel Dashboard → Storage → Blob
- Create a new Blob store
- Generate a Read/Write token

## Development

### Local Testing
1. Create `.env.local` file:
   ```env
   BASIC_AUTH_PASSWORD=your-password
   BLOB_READ_WRITE_TOKEN=your-blob-token
   ```

2. Run locally:
   ```bash
   vercel dev
   ```

3. Access: http://localhost:3000

### Vercel CLI
Useful commands:
```bash
# View environment variables
vercel env ls

# Pull environment variables to .env.local
vercel env pull

# Deploy to production
vercel --prod
```

## File Structure

```
tps-agent-ecosystem/
├── api/
│   ├── config.js          # GET/POST config endpoint
│   └── migrate.js         # Migration endpoint
├── data/
│   └── config.yaml        # Static fallback config
├── middleware.js          # Basic Auth (existing)
├── index.html             # Main app with edit UI
├── package.json           # Dependencies (@vercel/blob, js-yaml)
└── EDIT_MODE_SETUP.md     # This file
```

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Configure `BLOB_READ_WRITE_TOKEN` in Vercel
3. ✅ Deploy: `vercel --prod`
4. ✅ Test edit functionality
5. 🎉 Start editing your TPS Agent Ecosystem!

## Support

For issues or questions:
- Check Vercel logs for errors
- Review browser console for client-side errors
- Verify all environment variables are set
- Test API endpoints directly with curl/Postman

---

**Version**: 1.0
**Last Updated**: 2025-11-19
