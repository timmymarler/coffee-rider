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


export default function GroupsScreen() {
  const router = useRouter();
  const { capabilities, user } = useContext(AuthContext) || {};
  const { mapActions } = useContext(TabBarContext);
  const canAccessGroups = capabilities?.canAccessGroups === true;

  // State declarations
  const [creating, setCreating] = useState(false);
  const [actingOnInvite, setActingOnInvite] = useState(null);
  const [revokingInvite, setRevokingInvite] = useState(null);
  const [inviteeInput, setInviteeInput] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [leavingGroup, setLeavingGroup] = useState(false);
  // Collapsible section state
  const [membersExpanded, setMembersExpanded] = useState(true);
  const [sharedRoutesExpanded, setSharedRoutesExpanded] = useState(true);

  // Hooks
  const { invites, loading: invitesLoading, error: invitesError } = useInvitesEnriched(user?.uid, user?.email);
  const { invites: sentInvites, loading: sentInvitesLoading } = useSentInvitesEnriched(user?.uid);
  const { groups, loading: groupsLoading } = useAllUserGroups(user?.uid);
  const { routes: sharedRoutes, loading: routesLoading } = useGroupSharedRoutes(selectedGroupId);
  const { setPendingSavedRouteId, setEnableFollowMeAfterLoad } = useWaypointsContext();
  const { members, loading: membersLoading } = useGroupMembers(selectedGroupId);
  const { activeRide, isStarting, startRide, endRide } = useActiveRide(user);
  const { activeRides } = useMembersActiveRides(members?.map(m => m.uid) || []);

  // Auto-select first group when list loads and none selected
  useEffect(() => {
    if (!groupsLoading && groups?.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groupsLoading, groups, selectedGroupId]);

  if (!canAccessGroups) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ color: theme.colors.textMuted, textAlign: "center", marginBottom: 8 }}>
            Groups is a Pro/Admin feature.
          </Text>
          <Text style={{ color: theme.colors.textSecondary, textAlign: "center" }}>
            Upgrade your account from the Profile tab to unlock group rides and shared features.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections = [
    {
      key: "createGroup",
      content: (
        <View style={styles.cardWrap}>
          <CRCard>
            <CRLabel>Create a Group</CRLabel>
            <CRInput
              placeholder="Coffee Crew"
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.md }}>
              <TouchableOpacity
                style={{
                  backgroundColor: theme.colors.accent,
                  paddingVertical: 8,
                  paddingHorizontal: 18,
                  borderRadius: 8,
                  minWidth: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: creating || !groupName.trim() || !user?.uid ? 0.6 : 1,
                }}
                onPress={async () => {
                if (!groupName.trim()) return Alert.alert("Group name required");
                if (!user?.uid) return Alert.alert("Please sign in to create a group");
                try {
                  setCreating(true);
                  const groupId = await createGroup({
                    name: groupName.trim(),
                    userId: user.uid,
                    capabilities,
                  });
                  setSelectedGroupId(groupId);
                  setGroupName("");
                  Alert.alert("Group created", "You are the owner.");
                } catch (err) {
                  Alert.alert("Unable to create group", err?.message || "Unexpected error");
                } finally {
                  setCreating(false);
                }
              }}
              disabled={creating || !groupName.trim() || !user?.uid}
            >
                <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: "600" }}>
                  {creating ? "Creating…" : "Create Group"}
                </Text>
              </TouchableOpacity>
            </View>
          </CRCard>
        </View>
      ),
    },
    {
      key: "myGroups",
      content: (
        <View style={[styles.cardWrap, { zIndex: dropdownOpen ? 1000 : 1 }]}>
          <CRCard>
            <CRLabel>My Groups</CRLabel>
            {groupsLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : groups.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                No groups yet. Create one above.
              </Text>
            ) : (
              <DropDownPicker
                open={dropdownOpen}
                setOpen={setDropdownOpen}
                items={groups.map((g) => ({ label: g.name, value: g.id }))}
                value={selectedGroupId}
                setValue={setSelectedGroupId}
                placeholder="Select a group..."
                listMode="SCROLLVIEW"
                maxHeight={200}
                listItemLabelStyle={styles.listItemLabel}
                containerStyle={styles.dropdownContainer}
                style={styles.dropdownStyle}
                labelStyle={styles.dropdownLabel}
                textStyle={styles.dropdownText}
                dropDownContainerStyle={styles.dropdownMenuStyle}
                placeholderStyle={styles.dropdownPlaceholder}
                arrowIconStyle={{ tintColor: theme.colors.text }}
              />
            )}
          </CRCard>
        </View>
      ),
    },
    {
      key: "sendInvite",
      content: (
        <View style={styles.cardWrap}>
          <CRCard>
            <CRLabel>Send Invite (email or UID)</CRLabel>
            <CRInput
              placeholder="rider@example.com"
              value={inviteeInput}
              onChangeText={setInviteeInput}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: theme.spacing.md }}>
              <TouchableOpacity
                style={{
                  backgroundColor: theme.colors.accent,
                  paddingVertical: 8,
                  paddingHorizontal: 18,
                  borderRadius: 8,
                  minWidth: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: sendingInvite || !inviteeInput.trim() || !selectedGroupId ? 0.6 : 1,
                }}
                onPress={async () => {
                if (!inviteeInput.trim()) return;
                if (!user?.uid) return Alert.alert("Please sign in to send invites");
                try {
                  setSendingInvite(true);
                  if (!selectedGroupId) {
                    return Alert.alert("No group selected", "Create or select a group first.");
                  }
                  await sendInvite({
                    groupId: selectedGroupId,
                    inviteeEmail: inviteeInput.includes("@") ? inviteeInput.trim() : null,
                    inviteeUid: inviteeInput.includes("@") ? null : inviteeInput.trim(),
                    inviterId: user.uid,
                    capabilities,
                  });
                  setInviteeInput("");
                  Alert.alert("Invite sent", "Pending until accepted or expiry (30 days).");
                } catch (err) {
                  Alert.alert("Unable to send invite", err?.message || "Unexpected error");
                } finally {
                  setSendingInvite(false);
                }
              }}
              disabled={sendingInvite || !inviteeInput.trim() || !selectedGroupId}
            >
                <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: "600" }}>
                  {sendingInvite ? "Sending…" : "Send Invite"}
                </Text>
              </TouchableOpacity>
            </View>
          </CRCard>
        </View>
      ),
    },
    ...(selectedGroupId
      ? [
          {
            key: "members",
            content: (
              <View style={styles.cardWrap}>
                <CRCard>
                  <TouchableOpacity
                    onPress={() => setMembersExpanded((prev) => !prev)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}
                  >
                    <CRLabel>Members</CRLabel>
                    <MaterialCommunityIcons
                      name={membersExpanded ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                  {membersExpanded && (
                    <>
                      {membersLoading ? (
                        <ActivityIndicator color={theme.colors.primary} />
                      ) : members.length === 0 ? (
                        <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                          No members yet.
                        </Text>
                      ) : (
                        <>
                          {members.map((m) => {
                            const isCurrentUser = m.uid === user?.uid;
                            const isOwner = m.role === "owner";
                            const currentUserIsOwner = members.find(member => member.uid === user?.uid)?.role === "owner";
                            const canRemove = currentUserIsOwner && !isCurrentUser && !isOwner;
                            const hasActiveRide = activeRides[m.uid];
                            return (
                              <View key={m.uid} style={styles.memberItem}>
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Text style={styles.memberName}>
                                      {m.displayName || m.email || m.uid}
                                      {isCurrentUser ? " (you)" : ""}
                                    </Text>
                                    {hasActiveRide && (
                                      <MaterialCommunityIcons
                                        name="crosshairs-gps"
                                        size={14}
                                        color={theme.colors.danger}
                                      />
                                    )}
                                  </View>
                                  <Text style={styles.memberRole}>
                                    {isOwner ? "Owner" : "Member"}
                                  </Text>
                                </View>
                                {canRemove && (
                                  <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <TouchableOpacity
                                      style={{
                                        backgroundColor: theme.colors.danger,
                                        paddingVertical: 8,
                                        paddingHorizontal: 18,
                                        borderRadius: 8,
                                        minWidth: 70,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                      onPress={() => {
                                        Alert.alert(
                                          "Remove Member?",
                                          `Remove ${m.displayName || m.email || m.uid} from the group?`,
                                          [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                              text: "Remove",
                                              style: "destructive",
                                              onPress: async () => {
                                                setRemovingMemberId(m.uid);
                                                try {
                                                  await removeGroupMember({
                                                    groupId: selectedGroupId,
                                                    memberId: m.uid,
                                                    userId: user?.uid,
                                                    capabilities,
                                                  });
                                                  Alert.alert("Removed", "Member has been removed from the group.");
                                                } catch (err) {
                                                  Alert.alert("Unable to remove", err?.message || "Unexpected error");
                                                } finally {
                                                  setRemovingMemberId(null);
                                                }
                                              },
                                            },
                                          ]
                                        );
                                      }}
                                      disabled={removingMemberId === m.uid}
                                    >
                                      <Text style={{ color: theme.colors.intext, fontSize: 15, fontWeight: "600" }}>
                                        {removingMemberId === m.uid ? "…" : "Remove"}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                          {/* Leave Group button - only for non-owners */}
                          {members.find(m => m.uid === user?.uid)?.role !== "owner" && (
                            <CRButton
                              title={leavingGroup ? "Leaving…" : "Leave Group"}
                              variant="danger"
                              loading={leavingGroup}
                              onPress={() => {
                                Alert.alert(
                                  "Leave Group?",
                                  "You will no longer have access to this group and its shared routes.",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Leave",
                                      style: "destructive",
                                      onPress: async () => {
                                        setLeavingGroup(true);
                                        try {
                                          await leaveGroup({
                                            groupId: selectedGroupId,
                                            userId: user?.uid,
                                          });
                                          setSelectedGroupId(null);
                                          Alert.alert("Left", "You have left the group.");
                                        } catch (err) {
                                          Alert.alert("Unable to leave", err?.message || "Unexpected error");
                                        } finally {
                                          setLeavingGroup(false);
                                        }
                                      },
                                    },
                                  ]
                                );
                              }}
                              disabled={leavingGroup}
                              style={{ marginTop: theme.spacing.md }}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}
                </CRCard>
              </View>
            ),
          },
          {
            key: "sharedRoutes",
            content: (
              <View style={styles.cardWrap}>
                <CRCard>
                  <TouchableOpacity
                    onPress={() => setSharedRoutesExpanded((prev) => !prev)}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}
                  >
                    <CRLabel>Shared Routes</CRLabel>
                    <MaterialCommunityIcons
                      name={sharedRoutesExpanded ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                  {sharedRoutesExpanded && (
                    routesLoading ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : sharedRoutes.length === 0 ? (
                      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                        No shared routes yet.
                      </Text>
                    ) : (
                      sharedRoutes.map((route) => {
                        const isThisRideActive = activeRide?.rideId === route.id;
                        return (
                          <View key={route.id} style={styles.routeItem}>
                            <TouchableOpacity
                              onPress={() => {
                                setPendingSavedRouteId(route.id);
                                router.push("/map");
                              }}
                            >
                              <Text style={styles.routeName}>
                                {route.name || route.title || route.destination?.title || "Untitled route"}
                              </Text>
                              {route.distanceMeters && (
                                <Text style={styles.routeMeta}>
                                  {(route.distanceMeters / 1609).toFixed(1)} mi
                                  {route.waypoints?.length && ` · ${route.waypoints.length} stops`}
                                </Text>
                              )}
                            </TouchableOpacity>
                            <View style={{ marginTop: theme.spacing.sm }}>
                              {isThisRideActive ? (
                                <CRButton
                                  title="End Ride & Stop Sharing"
                                  variant="danger"
                                  onPress={() => {
                                    Alert.alert(
                                      "End Ride?",
                                      "This will stop sharing your location with other riders.",
                                      [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                          text: "End Ride",
                                          style: "destructive",
                                          onPress: endRide,
                                        },
                                      ]
                                    );
                                  }}
                                />
                              ) : (
                                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: theme.colors.accent,
                                      paddingVertical: 8,
                                      paddingHorizontal: 18,
                                      borderRadius: 8,
                                      minWidth: 100,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexDirection: 'row',
                                      gap: 8,
                                    }}
                                    onPress={() => {
                                      if (!selectedGroupId) {
                                        Alert.alert("No group selected");
                                        return;
                                      }
                                      Alert.alert(
                                        "Start Ride?",
                                        "This will share your location with other riders on this route in real-time.",
                                        [
                                          { text: "Cancel", style: "cancel" },
                                          {
                                            text: "Join Ride",
                                            onPress: async () => {
                                              await startRide(
                                                route.id,
                                                selectedGroupId,
                                                route.name || route.title || "Untitled Route"
                                              );
                                              setPendingSavedRouteId(route.id);
                                              setEnableFollowMeAfterLoad(true);
                                              router.push("/map");
                                            },
                                          },
                                        ]
                                      );
                                    }}
                                    disabled={!!activeRide || isStarting}
                                  >
                                    <MaterialCommunityIcons name="navigation-variant" size={16} color={theme.colors.primary} />
                                    <Text style={{ color: theme.colors.intext, fontSize: 16, fontWeight: "600" }}>
                                      {isStarting ? "Joining…" : "Join Ride"}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                              {activeRide && !isThisRideActive && (
                                <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 4, textAlign: "center" }}>
                                  End current ride to start this one
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )
                  )}
                </CRCard>
              </View>
            ),
          },
        ]
      : []),
    {
      key: "invites",
      content: (
        <View style={styles.cardWrap}>
          <CRCard>
            <CRLabel>Pending Invites</CRLabel>
            {invitesError && (
              <Text style={{ color: theme.colors.danger, marginTop: theme.spacing.md }}>
                {invitesError}
              </Text>
            )}
            {invitesLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : invites.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                No pending invites.
              </Text>
            ) : (
              invites.map((invite) => (
                <View key={invite.id} style={styles.inviteItem}>
                  <Text style={styles.inviteGroupName}>
                    {invite.groupName || invite.groupId}
                  </Text>
                  <Text style={styles.inviteBy}>
                    Invited by {invite.inviterName || invite.inviterId}
                  </Text>
                  <Text style={styles.inviteExpiry}>
                    Expires:{" "}
                    {invite.expiresAt?.toDate
                      ? invite.expiresAt.toDate().toLocaleDateString()
                      : ""}
                  </Text>
                  <View style={{ flexDirection: "row", marginTop: theme.spacing.md, gap: 8 }}>
                    <CRButton
                      title={actingOnInvite === invite.id ? "…" : "Accept"}
                      variant="accent"
                      loading={actingOnInvite === invite.id}
                      onPress={async () => {
                        setActingOnInvite(invite.id);
                        try {
                          const result = await acceptInvite({
                            inviteId: invite.id,
                            userId: user?.uid,
                          });
                          setSelectedGroupId(result.groupId);
                          Alert.alert("Joined", "You joined the group.");
                        } catch (err) {
                          Alert.alert("Unable to accept", err?.message || "Unexpected error");
                        } finally {
                          setActingOnInvite(null);
                        }
                      }}
                      disabled={actingOnInvite === invite.id}
                      style={{ flex: 1 }}
                    />
                    <CRButton
                      title={actingOnInvite === invite.id ? "…" : "Decline"}
                      variant="danger"
                      loading={actingOnInvite === invite.id}
                      onPress={async () => {
                        setActingOnInvite(invite.id);
                        try {
                          await declineInvite({
                            inviteId: invite.id,
                            userId: user?.uid,
                          });
                          Alert.alert("Declined", "Invite declined.");
                        } catch (err) {
                          Alert.alert("Unable to decline", err?.message || "Unexpected error");
                        } finally {
                          setActingOnInvite(null);
                        }
                      }}
                      disabled={actingOnInvite === invite.id}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ))
            )}
          </CRCard>
        </View>
      ),
    },
    {
      key: "sentInvites",
      content: (
        <View style={styles.cardWrap}>
          <CRCard>
            <CRLabel>Sent Invites</CRLabel>
            {sentInvitesLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : sentInvites.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                No pending sent invites.
              </Text>
            ) : (
              sentInvites.map((invite) => (
                <View key={invite.id} style={styles.inviteItem}>
                  <Text style={styles.inviteGroupName}>
                    {invite.groupName || invite.groupId}
                  </Text>
                  <Text style={styles.inviteBy}>
                    Invited: {invite.inviteeName || invite.inviteeEmail || invite.inviteeUid}
                  </Text>
                  <Text style={styles.inviteExpiry}>
                    Expires:{" "}
                    {invite.expiresAt?.toDate
                      ? invite.expiresAt.toDate().toLocaleDateString()
                      : ""}
                  </Text>
                  <CRButton
                    title={revokingInvite === invite.id ? "Revoking…" : "Revoke"}
                    variant="danger"
                    loading={revokingInvite === invite.id}
                    onPress={async () => {
                      setRevokingInvite(invite.id);
                      try {
                        await revokeInvite({
                          inviteId: invite.id,
                          capabilities,
                        });
                        Alert.alert("Revoked", "Invite has been revoked.");
                      } catch (err) {
                        Alert.alert("Unable to revoke", err?.message || "Unexpected error");
                      } finally {
                        setRevokingInvite(null);
                      }
                    }}
                    disabled={revokingInvite === invite.id}
                    style={{ marginTop: theme.spacing.md }}
                  />
                </View>
              ))
            )}
          </CRCard>
        </View>
      ),
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => item.content}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: theme.spacing.lg,
          paddingBottom: 100,
        }}
        scrollEnabled={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: theme.spacing.sm,
  },
  modalContentContainer: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  dropdownContainer: {
    marginTop: theme.spacing.sm,
  },
  dropdownStyle: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
  },
  dropdownLabel: {
    color: theme.colors.text,
  },
  dropdownText: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.body.fontWeight,
  },
  dropdownMenuStyle: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    position: 'absolute',
    top: '100%',
    zIndex: 1000,
    elevation: 10,
  },
  dropdownPlaceholder: {
    color: theme.colors.textMuted,
  },
  listItemLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.body.fontWeight,
  },
  memberItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  memberName: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },
  memberRole: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  inviteItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inviteGroupName: {
    color: theme.colors.text,
    fontWeight: "600",
  },
  inviteBy: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  inviteExpiry: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  routeItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  routeName: {
    color: theme.colors.accentMid,
    fontWeight: "600",
    fontSize: 14,
  },
  routeMeta: {
    color: theme.colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  routeActive: {
    color: theme.colors.success,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});
