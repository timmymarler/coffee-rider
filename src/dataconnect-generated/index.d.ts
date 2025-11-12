import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CoffeeShop_Key {
  id: UUIDString;
  __typename?: 'CoffeeShop_Key';
}

export interface CreateRideData {
  ride_insert: Ride_Key;
}

export interface CreateRideVariables {
  organizerId: UUIDString;
  date: DateString;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  routeDescription: string;
  time: string;
  title: string;
}

export interface GetRidesForUserData {
  user?: {
    rides_via_RideParticipant: ({
      id: UUIDString;
      title: string;
      date: DateString;
      time: string;
      startLatitude: number;
      startLongitude: number;
      endLatitude: number;
      endLongitude: number;
    } & Ride_Key)[];
  };
}

export interface GetRidesForUserVariables {
  userId: UUIDString;
}

export interface JoinRideData {
  rideParticipant_insert: RideParticipant_Key;
}

export interface JoinRideVariables {
  rideId: UUIDString;
  userId: UUIDString;
  status: string;
}

export interface ListCoffeeShopsData {
  coffeeShops: ({
    id: UUIDString;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } & CoffeeShop_Key)[];
}

export interface Review_Key {
  id: UUIDString;
  __typename?: 'Review_Key';
}

export interface RideParticipant_Key {
  userId: UUIDString;
  rideId: UUIDString;
  __typename?: 'RideParticipant_Key';
}

export interface Ride_Key {
  id: UUIDString;
  __typename?: 'Ride_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateRideRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateRideVariables): MutationRef<CreateRideData, CreateRideVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateRideVariables): MutationRef<CreateRideData, CreateRideVariables>;
  operationName: string;
}
export const createRideRef: CreateRideRef;

export function createRide(vars: CreateRideVariables): MutationPromise<CreateRideData, CreateRideVariables>;
export function createRide(dc: DataConnect, vars: CreateRideVariables): MutationPromise<CreateRideData, CreateRideVariables>;

interface ListCoffeeShopsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListCoffeeShopsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListCoffeeShopsData, undefined>;
  operationName: string;
}
export const listCoffeeShopsRef: ListCoffeeShopsRef;

export function listCoffeeShops(): QueryPromise<ListCoffeeShopsData, undefined>;
export function listCoffeeShops(dc: DataConnect): QueryPromise<ListCoffeeShopsData, undefined>;

interface JoinRideRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: JoinRideVariables): MutationRef<JoinRideData, JoinRideVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: JoinRideVariables): MutationRef<JoinRideData, JoinRideVariables>;
  operationName: string;
}
export const joinRideRef: JoinRideRef;

export function joinRide(vars: JoinRideVariables): MutationPromise<JoinRideData, JoinRideVariables>;
export function joinRide(dc: DataConnect, vars: JoinRideVariables): MutationPromise<JoinRideData, JoinRideVariables>;

interface GetRidesForUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetRidesForUserVariables): QueryRef<GetRidesForUserData, GetRidesForUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetRidesForUserVariables): QueryRef<GetRidesForUserData, GetRidesForUserVariables>;
  operationName: string;
}
export const getRidesForUserRef: GetRidesForUserRef;

export function getRidesForUser(vars: GetRidesForUserVariables): QueryPromise<GetRidesForUserData, GetRidesForUserVariables>;
export function getRidesForUser(dc: DataConnect, vars: GetRidesForUserVariables): QueryPromise<GetRidesForUserData, GetRidesForUserVariables>;

