import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'coffee-rider',
  location: 'europe-west2'
};

export const createRideRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateRide', inputVars);
}
createRideRef.operationName = 'CreateRide';

export function createRide(dcOrVars, vars) {
  return executeMutation(createRideRef(dcOrVars, vars));
}

export const listCoffeeShopsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCoffeeShops');
}
listCoffeeShopsRef.operationName = 'ListCoffeeShops';

export function listCoffeeShops(dc) {
  return executeQuery(listCoffeeShopsRef(dc));
}

export const joinRideRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'JoinRide', inputVars);
}
joinRideRef.operationName = 'JoinRide';

export function joinRide(dcOrVars, vars) {
  return executeMutation(joinRideRef(dcOrVars, vars));
}

export const getRidesForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRidesForUser', inputVars);
}
getRidesForUserRef.operationName = 'GetRidesForUser';

export function getRidesForUser(dcOrVars, vars) {
  return executeQuery(getRidesForUserRef(dcOrVars, vars));
}

