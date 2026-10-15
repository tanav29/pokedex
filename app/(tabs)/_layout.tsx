import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/**
 * Four tabs, ordered by how often a player has a reason to open them:
 * pull something, look at what you have, work the daily list, spend.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#E2483F",
        tabBarInactiveTintColor: "#5D6178",
        tabBarStyle: {
          backgroundColor: "#0E1017",
          borderTopColor: "#222638",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: "Outfit_600SemiBold",
          fontSize: 10,
        },
        sceneStyle: { backgroundColor: "#141620" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Encounter",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipse-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dex"
        options={{
          title: "Dex",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: "Quests",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Trainer",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
