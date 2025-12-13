# Deployment Guide

## Quick Reference

### Deploy to V2 Project (Default - Active Development)
```bash
vercel --prod
```
This deploys to `agentcanvas-app-v2` (the active project).

### Deploy to Original Project (Frozen - Manual Only)
If you need to deploy to the original frozen project:

1. **Backup current .vercel directory:**
   ```bash
   mv .vercel .vercel.v2
   ```

2. **Restore original project link:**
   ```bash
   mv .vercel.original .vercel
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Restore v2 project link:**
   ```bash
   mv .vercel .vercel.original
   mv .vercel.v2 .vercel
   ```

**Note:** The original project is frozen and should only be updated manually when absolutely necessary.

## Project Information

- **Original Project:** See `.vercel.original/project.json`
- **V2 Project:** See `.vercel/project.json`
- **Full Details:** See `.vercel/PROJECT_INFO.md`

