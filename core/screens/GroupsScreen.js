import { CRButton } from "@components-ui/CRButton";
import { CRCard } from "@components-ui/CRCard";
import { CRInput } from "@components-ui/CRInput";
import { CRLabel } from "@components-ui/CRLabel";
import { AuthContext } from "@context/AuthContext";
import { TabBarContext } from "@context/TabBarContext";
import { useAllUserGroups, useGroupMembers, useInvitesEnriched, useSentInvitesEnriched } from "@core/groups/hooks";
import { acceptInvite, createGroup, declineInvite, revokeInvite, sendInvite } from "@core/groups/service";
import { useGroupSharedRoutes } from "@core/map/routes/useSharedRides";
import useActiveRide from "@core/map/routes/useActiveRide";
import { useWaypointsContext } from "@core/map/waypoints/WaypointsContext";
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
  
  // Hooks
  const { invites, loading: invitesLoading, error: invitesError } = useInvitesEnriched(user?.uid, user?.email);
  const { invites: sentInvites, loading: sentInvitesLoading } = useSentInvitesEnriched(user?.uid);
  const { groups, loading: groupsLoading } = useAllUserGroups(user?.uid);
  const { routes: sharedRoutes, loading: routesLoading } = useGroupSharedRoutes(selectedGroupId);
  const { setPendingSavedRouteId } = useWaypointsContext();
  const { members, loading: membersLoading } = useGroupMembers(selectedGroupId);
  const { activeRide, isStarting, startRide, endRide } = useActiveRide(user);

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
            <CRButton
              title={creating ? "Creating…" : "Create Group"}
              loading={creating}
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
              style={{ marginTop: theme.spacing.md }}
            />
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
            <CRButton
              title={sendingInvite ? "Sending…" : "Send Invite"}
              loading={sendingInvite}
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
              style={{ marginTop: theme.spacing.md }}
            />
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
                  <CRLabel>Members</CRLabel>
                  {membersLoading ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : members.length === 0 ? (
                    <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
                      No members yet.
                    </Text>
                  ) : (
                    members.map((m) => (
                      <View key={m.uid} style={styles.memberItem}>
                        <View>
                          <Text style={styles.memberName}>
                            {m.displayName || m.email || m.uid}
                          </Text>
                          <Text style={styles.memberRole}>
                            {m.role === "owner" ? "Owner" : "Member"}
                          </Text>
                        </View>
                      </View>
                    ))
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
                  <CRLabel>Shared Routes</CRLabel>
                  {routesLoading ? (
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
                              <CRButton
                                title={isStarting ? "Starting…" : "Start Ride & Share Location"}
                                loading={isStarting}
                                disabled={!!activeRide} // Disable if already on a different ride
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
                                        text: "Start Ride",
                                        onPress: async () => {
                                          await startRide(
                                            route.id,
                                            selectedGroupId,
                                            route.name || route.title || "Untitled Route"
                                          );
                                          
                                          // Switch to Maps tab
                                          setPendingSavedRouteId(route.id);
                                          router.push("/map");
                                          
                                          // Enable Follow Me mode after a short delay to let map load
                                          setTimeout(() => {
                                            if (mapActions?.toggleFollow && !mapActions?.isFollowing?.()) {
                                              mapActions.toggleFollow();
                                            }
                                          }, 500);
                                        },
                                      },
                                    ]
                                  );
                                }}
                              />
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
    color: theme.colors.text,
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
