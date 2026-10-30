---
name: bedrock-mobile-companion
description: Phone-first workflow for Minecraft Bedrock add-on source generation without desktop MCP tools.
---

# Bedrock Mobile Companion

## Purpose
Work from a phone when Claude cannot access local desktop programs, the user's filesystem, or Blockbench MCP.

## Mandatory boundaries
- Never claim to control Blockbench, Blender, Snowstorm, a PC, or the user's phone.
- Never claim MCP is connected in mobile-only mode.
- Do not require PowerShell, local Node.js, Git, or desktop installers.
- Generate downloadable source files only when the environment actually supports file creation; otherwise provide complete file contents and exact paths.
- Keep work in small batches and give clear copy/import instructions.
- Target Bedrock 1.21+ through the latest stable release, with explicit compatibility profiles.
- Keep stable, beta, and experimental APIs separate. Never label an untested project as game-tested.

## Mobile workflow
1. Write a short design specification and file tree.
2. Generate Resource Pack assets: Bedrock geometry, texture layout, animation JSON, animation controllers, render controllers, and particle JSON where supported.
3. Generate Behavior Pack manifests and scripts separately; use only APIs verified for the selected compatibility profile.
4. Keep assets compact for Android performance.
5. Give each file its exact relative path and a copy/import checklist.
6. Run all available offline validation; clearly state what could not be checked on the phone.
7. Package BP/RP as `.mcaddon` only if file-generation tools are actually available.
8. Include a PC handoff checklist for later Blockbench MCP refinement.

## Blockbench fallback
Without MCP, generate Blockbench-compatible Bedrock geometry and animation files directly. The user can import them into Blockbench later. Do not claim live editing or viewport preview.

## Mobile deliverables
- Keep source files small and logically grouped.
- Avoid requiring manual edits to long scripts.
- Prefer JSON validation and compatibility checks over desktop automation.
- Report exactly what was generated, statically checked, imported, and tested.

## Safety and design
Focus on decorative, exploration, building, accessibility, companion, and support features.
