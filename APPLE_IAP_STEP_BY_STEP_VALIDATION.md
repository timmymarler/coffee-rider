# Apple IAP Step-by-Step Validation (No EAS Build Required)

Goal: Validate one behavior at a time before any new cloud build.

## Rules
1. Change only one behavior per cycle.
2. Run only local checks first.
3. Run one manual test case at a time.
4. Do not bump version/build until all gates pass.
5. Do not run EAS build unless explicitly approved.

## Current Scope
- Behavior under test: stop repeated iCloud password prompts caused by automatic restore retry loops.
- Changed file: core/payments/useAppleSubscriptionV2.js

## Gate 1: Static Validation
1. File diagnostics show no errors.
2. No automatic restore polling loop exists in purchase timeout path.
3. Purchase timeout returns pending state instead of auto-restoring.

Pass criteria:
- No diagnostics in changed file.
- Code path confirms pending return and no looped restore call.

## Gate 2: Controlled Local Runtime Validation (VS Code simulator, no EAS)
1. Run the app locally from VS Code using `npm run ios` (script uses `expo run:ios`).
2. Open subscriptions screen.
3. Confirm screen loads and product fetch does not crash.
4. Leave screen idle for 1-2 minutes.
5. Confirm no automatic restore flow starts on its own.

Pass criteria:
- No unexpected transition into restore state while idle.
- No repeated automated purchase/restore attempts in logs/UI.

Note:
- iOS simulator is useful for local flow/state validation.
- Real Apple account credential prompt behavior cannot be fully validated in simulator.

## Gate 3: Manual Restore Behavior Validation (VS Code simulator)
1. Tap Restore Purchases manually once.
2. Confirm restore completes or returns clear message.
3. Confirm no repeated restore retries without another tap.

Pass criteria:
- Restore only runs from user action.
- No background retry loop.

## Gate 4: Activation Convergence (Local)
1. After purchase, wait for backend propagation.
2. Re-open subscription screen.
3. Confirm active entitlement appears when backend catches up.

Pass criteria:
- Eventual transition from pending to active without forced repeated auth prompts.

## Gate 5: Real-Device Confirmation (Existing TestFlight build only)
1. Use physical iPhone with current installed TestFlight build (no new build).
2. Run one purchase attempt.
3. Count Apple credential prompts from start to completion.

Pass criteria:
- No repeated credential prompt loop without extra user action.
- If activation lags, UI stays in pending/processing rather than failing hard.

## Gate 6: Release Readiness
1. Commit only this behavior fix.
2. Keep version/build unchanged until explicitly requested.
3. Build only after explicit user approval.

Pass criteria:
- Minimal diff, one scoped commit, user-approved build step.

## Test Log Template
Use one entry per run:
- Date/time:
- Device + iOS version:
- Build source: (VS Code simulator / existing TestFlight)
- Test case: (Gate 2/3/4/5)
- Expected result:
- Actual result:
- Prompt count observed:
- Outcome: PASS/FAIL
- Notes:
