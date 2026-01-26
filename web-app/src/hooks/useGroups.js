import { collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'

const GROUP_MEMBERS_SUBCOLLECTION = 'members'

export function useGroups() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setGroups([])
      setLoading(false)
      return
    }

    // Find all member docs where this user participates
    const q = query(
      collectionGroup(db, GROUP_MEMBERS_SUBCOLLECTION),
      where('uid', '==', user.uid)
    )
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        // Get the group IDs from the member docs
        const groupIds = snapshot.docs.map(memberDoc => 
          memberDoc.ref.parent.parent.id
        )
        
        // Fetch the actual group documents with member counts
        const groupPromises = groupIds.map(async (groupId) => {
          const groupDoc = await getDoc(doc(db, 'groups', groupId))
          if (!groupDoc.exists()) return null
          
          // Count members
          const membersCol = collection(db, 'groups', groupId, GROUP_MEMBERS_SUBCOLLECTION)
          const memberDocs = await getDocs(membersCol)
          
          return {
            id: groupId,
            ...groupDoc.data(),
            memberCount: memberDocs.size
          }
        })
        
        const groupData = (await Promise.all(groupPromises)).filter(Boolean)
        setGroups(groupData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching groups:', err)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [user])

  return { groups, loading }
}
