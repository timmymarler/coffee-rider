import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'

export function useSavedRoutes() {
  const { user } = useAuth()
  const [routes, setRoutes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRoutes([])
      setLoading(false)
      return
    }

    // Query user's own routes from the routes collection
    const q = query(
      collection(db, 'routes'),
      where('createdBy', '==', user.uid)
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setRoutes(data)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const saveRoute = async (routeData) => {
    if (!user) return null
    
    const docRef = await addDoc(collection(db, 'routes'), {
      ...routeData,
      createdBy: user.uid,
      ownerId: user.uid,
      visibility: 'private',
      createdAt: serverTimestamp(),
    })
    return docRef.id
  }

  const deleteRoute = async (routeId) => {
    await deleteDoc(doc(db, 'routes', routeId))
  }

  return { routes, loading, saveRoute, deleteRoute }
}
