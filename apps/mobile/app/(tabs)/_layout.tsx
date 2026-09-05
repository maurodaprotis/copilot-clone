import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, shadow } from "../../src/theme";
import { useIsDesktopWeb } from "../../src/ui";

/** Outline-ish tab glyphs (SF Symbols–like), no Material chrome. */
function TabGlyph({
  kind,
  focused,
}: {
  kind: "home" | "grid" | "list" | "bars" | "more";
  focused: boolean;
}) {
  const color = focused ? colors.tabActive : colors.tabInactive;
  const map = {
    home: "⌂",
    grid: "▦",
    list: "☰",
    bars: "▥",
    more: "•••",
  } as const;
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 28 }}>
      <Text style={{ fontSize: kind === "more" ? 16 : 20, color, fontWeight: focused ? "700" : "400" }}>
        {map[kind]}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const desktop = useIsDesktopWeb();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          fontFamily,
          marginBottom: Platform.OS === "web" ? 4 : 0,
        },
        tabBarStyle: desktop
          ? { display: "none", height: 0, overflow: "hidden" }
          : {
              backgroundColor: colors.bgElevated,
              borderTopColor: "rgba(27,43,75,0.06)",
              borderTopWidth: StyleSheet.hairlineWidth,
              height: Platform.OS === "web" ? 64 : undefined,
              paddingTop: 6,
              ...shadow.tabBar,
            },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabGlyph kind="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ focused }) => <TabGlyph kind="grid" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ focused }) => <TabGlyph kind="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cash-flow"
        options={{
          title: "Cash Flow",
          tabBarIcon: ({ focused }) => <TabGlyph kind="bars" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabGlyph kind="more" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
