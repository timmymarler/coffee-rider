import { CreateRideData, CreateRideVariables, ListCoffeeShopsData, JoinRideData, JoinRideVariables, GetRidesForUserData, GetRidesForUserVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateRide(options?: useDataConnectMutationOptions<CreateRideData, FirebaseError, CreateRideVariables>): UseDataConnectMutationResult<CreateRideData, CreateRideVariables>;
export function useCreateRide(dc: DataConnect, options?: useDataConnectMutationOptions<CreateRideData, FirebaseError, CreateRideVariables>): UseDataConnectMutationResult<CreateRideData, CreateRideVariables>;

export function useListCoffeeShops(options?: useDataConnectQueryOptions<ListCoffeeShopsData>): UseDataConnectQueryResult<ListCoffeeShopsData, undefined>;
export function useListCoffeeShops(dc: DataConnect, options?: useDataConnectQueryOptions<ListCoffeeShopsData>): UseDataConnectQueryResult<ListCoffeeShopsData, undefined>;

export function useJoinRide(options?: useDataConnectMutationOptions<JoinRideData, FirebaseError, JoinRideVariables>): UseDataConnectMutationResult<JoinRideData, JoinRideVariables>;
export function useJoinRide(dc: DataConnect, options?: useDataConnectMutationOptions<JoinRideData, FirebaseError, JoinRideVariables>): UseDataConnectMutationResult<JoinRideData, JoinRideVariables>;

export function useGetRidesForUser(vars: GetRidesForUserVariables, options?: useDataConnectQueryOptions<GetRidesForUserData>): UseDataConnectQueryResult<GetRidesForUserData, GetRidesForUserVariables>;
export function useGetRidesForUser(dc: DataConnect, vars: GetRidesForUserVariables, options?: useDataConnectQueryOptions<GetRidesForUserData>): UseDataConnectQueryResult<GetRidesForUserData, GetRidesForUserVariables>;
