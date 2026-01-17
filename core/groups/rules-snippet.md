# Firestore rules snippet (groups and invites)

This snippet assumes a custom auth claim `role` with values `pro` or `admin` for creators. Invites live at a top-level `groupInvites/{inviteId}` and groups at `groups/{groupId}` with a `members` subcollection. Expiry is enforced at write time for accept/decline.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthed() {
      return request.auth != null;
    }

    function isProOrAdmin() {
      return isAuthed() && request.auth.token.role in ['pro', 'admin'];
    }

    match /groups/{groupId} {
      allow create: if isProOrAdmin();
      allow read: if isAuthed();
      allow update, delete: if isProOrAdmin() && request.auth.uid == resource.data.ownerId;

      match /members/{memberId} {
        allow read: if isAuthed();
        allow create, update, delete: if isProOrAdmin() && request.auth.uid == resource.data.ownerId;
      }
    }

    match /groupInvites/{inviteId} {
      allow create: if isProOrAdmin();

      allow read: if isAuthed() &&
        (request.auth.uid == resource.data.inviteeUid || isProOrAdmin());

      allow update: if (
        // Invitee accept/decline while pending and not expired
        isAuthed() &&
        request.auth.uid == resource.data.inviteeUid &&
        resource.data.status == 'pending' &&
        request.time < resource.data.expiresAt &&
        request.resource.data.status in ['accepted', 'declined']
      ) || (
        // Owner/mod revoke or expire
        isProOrAdmin()
      );
    }
  }
}
```

Notes:
- Store `expiresAt` as a Firestore `timestamp` so the rule can compare `request.time`.
- If you extend roles (e.g., moderators), widen `isProOrAdmin()` accordingly.
- Add indexes for common queries (invites by invitee, group members, active groups by owner).
