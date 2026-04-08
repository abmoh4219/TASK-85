# Issue Recheck (Round 4)

Date: 2026-04-08  
Method: static-only recheck of the same 5 previously flagged issues

## Status by Issue

1) **High — JWT secret fallback risk**  
**Result:** Fixed  
**Evidence:** `repo/backend/src/modules/auth/auth.module.ts:19`, `repo/backend/src/common/strategies/jwt.strategy.ts:24`  
No hardcoded fallback secret remains; both read `JWT_SECRET` from config.

2) **High — Prompt-level “all data at rest encrypted using AES-256” only partial**  
**Result:** Still Open (Not Fully Fixed)  
**Evidence:**
- Encryption scope still excludes structural fields and relies on infrastructure encryption for those: `repo/backend/src/common/transformers/aes.transformer.ts:41`, `repo/backend/src/common/transformers/aes.transformer.ts:42`, `repo/backend/src/common/transformers/aes.transformer.ts:44`
- Plaintext persisted fields still exist in core entities (example: username/password hash in users): `repo/backend/src/modules/users/user.entity.ts:22`, `repo/backend/src/modules/users/user.entity.ts:25`
- No static evidence of DB-native AES-at-rest implementation (`pgcrypto` / DB transparent encryption) found in backend source.

**Note:** Coverage has improved significantly (many additional encrypted columns), but against strict prompt wording (“all data at rest”), static evidence still does not prove full closure.

3) **High — Documentation/implementation mismatch**  
**Result:** Fixed  
**Evidence:**
- A/B assignment docs now match hash-bucket implementation: `docs/questions.md:34`, `repo/backend/src/modules/rules-engine/rules-engine.service.ts:356`
- Token storage docs align with frontend implementation: `docs/questions.md:54`, `repo/frontend/src/features/auth/AuthContext.tsx:30`, `repo/frontend/src/lib/api-client.ts:30`
- Substitute policy docs now explicitly describe implemented case-by-case flow and mark catalog substitutes as future work: `docs/questions.md:124`

4) **Medium — Rules impact assessment too static/categorical**  
**Result:** Fixed  
**Evidence:** `repo/backend/src/modules/rules-engine/rules-engine.service.ts:154`, `repo/backend/src/modules/rules-engine/rules-engine.service.ts:171`, `repo/backend/src/modules/rules-engine/rules-engine.service.ts:187`, `repo/backend/src/modules/rules-engine/rules-engine.service.ts:201`  
Impact assessment now computes affected workflows from actual rule-definition keys and includes concrete `definitionDiff` output.

5) **Medium — Scalar body extraction without DTO validation**  
**Result:** Fixed  
**Evidence:**
- DTO-based bodies in the previously flagged endpoints: `repo/backend/src/modules/procurement/procurement.controller.ts:223`, `repo/backend/src/modules/projects/projects.controller.ts:54`, `repo/backend/src/modules/projects/projects.controller.ts:86`
- Validation DTOs present: `repo/backend/src/modules/procurement/dto/update-line-price.dto.ts:1`, `repo/backend/src/modules/projects/dto/advance-status.dto.ts:1`
- Static search found no `@Body('...')` usage in module controllers.

## Final Snapshot
- **Fixed:** #1, #3, #4, #5
- **Open:** #2 (strict full-scope AES-256 at-rest requirement)
