const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'coffee-rider',
  location: 'europe-west2'
};
exports.connectorConfig = connectorConfig;

const createRideRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateRide', inputVars);
}
createRideRef.operationName = 'CreateRide';
exports.createRideRef = createRideRef;

exports.createRide = function createRide(dcOrVars, vars) {
  return executeMutation(createRideRef(dcOrVars, vars));
};

const listCoffeeShopsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListCoffeeShops');
}
listCoffeeShopsRef.operationName = 'ListCoffeeShops';
exports.listCoffeeShopsRef = listCoffeeShopsRef;

exports.listCoffeeShops = function listCoffeeShops(dc) {
  return executeQuery(listCoffeeShopsRef(dc));
};

const joinRideRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'JoinRide', inputVars);
}
joinRideRef.operationName = 'JoinRide';
exports.joinRideRef = joinRideRef;

exports.joinRide = function joinRide(dcOrVars, vars) {
  return executeMutation(joinRideRef(dcOrVars, vars));
};

const getRidesForUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetRidesForUser', inputVars);
}
getRidesForUserRef.operationName = 'GetRidesForUser';
exports.getRidesForUserRef = getRidesForUserRef;

exports.getRidesForUser = function getRidesForUser(dcOrVars, vars) {
  return executeQuery(getRidesForUserRef(dcOrVars, vars));
};
