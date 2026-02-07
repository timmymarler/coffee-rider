import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import theme from "@themes";
import { useSavedRoutes } from "@core/map/routes/useSavedRoutes";

export default function RouteDropdown({ selectedRouteId, setSelectedRouteId }) {
  const { routes, loading } = useSavedRoutes(true);
  const [open, setOpen] = useState(false);
  const colors = theme.colors;

  return (
    <View style={{
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.inputBackground,
      minHeight: 44,
      justifyContent: 'center',
    }}>
      {loading ? (
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Loading routes...</Text>
      ) : routes.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>No public routes found</Text>
      ) : (
        <View>
          <TouchableOpacity
            style={{ minHeight: 24 }}
            onPress={() => setOpen(!open)}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.textDark || '#222', fontSize: 15, fontWeight: '500' }}>
              {selectedRouteId
                ? routes.find(r => r.id === selectedRouteId)?.name || 'Select a route'
                : 'Select a route'}
            </Text>
          </TouchableOpacity>
          {open && (
            <View style={{ marginTop: 8, backgroundColor: colors.inputBackground, borderRadius: 6, borderWidth: 1, borderColor: colors.inputBorder, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
              {routes.map(route => (
                <TouchableOpacity
                  key={route.id}
                  style={{ paddingVertical: 8, paddingHorizontal: 4 }}
                  onPress={() => {
                    setSelectedRouteId(route.id);
                    setOpen(false);
                  }}
                >
                  <Text style={{ color: colors.textDark || '#222', fontSize: 15 }}>{route.name || 'Unnamed Route'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}