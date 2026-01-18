const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { doc, setDoc, updateDoc } = require('firebase/firestore');

async function main() {
  const projectId = 'coffee-rider-v2-test';
  const rules = readFileSync('firestore.rules', 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  const userId = 'user_abc';
  const proId = 'pro_xyz';

  const userCtx = testEnv.authenticatedContext(userId);
  const proCtx = testEnv.authenticatedContext(proId);

  const userDb = userCtx.firestore();
  const proDb = proCtx.firestore();

  const userDocRef = doc(userDb, 'users', userId);
  const proDocRef = doc(proDb, 'users', proId);

  // Seed user roles
  await assertSucceeds(setDoc(userDocRef, { role: 'user' }));
  await assertSucceeds(setDoc(proDocRef, { role: 'pro' }));

  // Seed a private route owned by the user
  const routeId = 'route_1';
  const userRouteRef = doc(userDb, 'routes', routeId);
  await assertSucceeds(setDoc(userRouteRef, {
    createdBy: userId,
    visibility: 'private',
    name: 'Test Route',
  }));

  // Try upgrading visibility to public as a USER (should fail)
  await assertFails(updateDoc(userRouteRef, { visibility: 'public' }));

  // Same route as PRO owner (must exist in pro context too)
  const proRouteRef = doc(proDb, 'routes', routeId);
  // Mirror the route in pro context to allow update
  // Note: Writing the same doc from pro context will be rejected since createdBy != proId
  // So we only attempt the update; rules check createdBy == request.auth.uid, so this should fail unless
  // we first create a pro-owned route.

  const proOwnedRouteRef = doc(proDb, 'routes', 'route_pro');
  await assertSucceeds(setDoc(proOwnedRouteRef, {
    createdBy: proId,
    visibility: 'private',
    name: 'Pro Route',
  }));

  // Upgrading visibility to public as PRO (should succeed)
  await assertSucceeds(updateDoc(proOwnedRouteRef, { visibility: 'public' }));

  console.log('Rules test completed: user share denied, pro share allowed.');

  await testEnv.cleanup();
}

main().catch((err) => {
  console.error('Rules test failed:', err);
  process.exit(1);
});
