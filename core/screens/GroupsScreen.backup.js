// Backup of GroupsScreen.js before restore on 2026-02-02
import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { AuthContext } from "@context/AuthContext";
import { TabBarContext } from "@context/TabBarContext";
import { useAllUserGroups, useGroupMembers, useInvitesEnriched, useSentInvitesEnriched } from "@core/groups/hooks";
import { acceptInvite, createGroup, declineInvite, leaveGroup, removeGroupMember, revokeInvite, sendInvite } from "@core/groups/service";
import useActiveRide from "@core/map/routes/useActiveRide";
import { useGroupSharedRoutes, useMembersActiveRides } from "@core/map/routes/useSharedRides";
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
// ...existing code...