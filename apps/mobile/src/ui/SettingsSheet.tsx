import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fontFamily, layout, radius, shadow, spacing, useTheme } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

export type SettingsNavId =
  | "general"
  | "account"
  | "subscription"
  | "banks"
  | "fx"
  | "about";

const NAV: { id: SettingsNavId; label: string; section: string; badge?: boolean }[] = [
  { id: "general", label: "General", section: "SETTINGS" },
  { id: "account", label: "Account", section: "SETTINGS" },
  { id: "subscription", label: "Subscription", section: "SETTINGS", badge: true },
  { id: "banks", label: "Banks & institutions", section: "CONNECTIONS" },
  { id: "about", label: "About", section: "SUPPORT" },
];

type Props = {
  children: ReactNode;
  activeNav?: SettingsNavId;
  onNavChange?: (id: SettingsNavId) => void;
  title?: string;
};

/**
 * Settings chrome: desktop = centered two-pane modal over dimmed canvas;
 * mobile = pass-through (caller uses Screen / stack modal).
 */
export function SettingsSheet({
  children,
  activeNav = "general",
  onNavChange,
  title = "General",
}: Props) {
  const desktop = useIsDesktopWeb();
  const router = useRouter();
  const { colors, type } = useTheme();
  const [localNav, setLocalNav] = useState<SettingsNavId>(activeNav);
  const nav = onNavChange ? activeNav : localNav;
  const setNav = (id: SettingsNavId) => {
    if (onNavChange) onNavChange(id);
    else setLocalNav(id);
  };

  if (!desktop) {
    return <>{children}</>;
  }

  const sections = ["SETTINGS", "CONNECTIONS", "SUPPORT"] as const;

  return (
    <View
      style={[styles.scrim, { backgroundColor: colors.bgModalScrim }]}
      accessibilityViewIsModal
      pointerEvents="box-none"
    >
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => router.back()}
        accessibilityLabel="Dismiss settings"
      />
      <View
        style={[
          styles.modal,
          { backgroundColor: colors.bgElevated },
          shadow.modal,
        ]}
        pointerEvents="auto"
      >
        <View
          style={[
            styles.rail,
            {
              backgroundColor: colors.bgPage,
              borderRightColor: colors.borderSubtle,
            },
          ]}
        >
          <Text
            style={[
              type.title3,
              {
                paddingHorizontal: spacing.sm,
                marginBottom: spacing.md,
                fontFamily,
                color: colors.textPrimary,
              },
            ]}
          >
            Settings
          </Text>
          {sections.map((section) => (
            <View key={section} style={styles.sectionBlock}>
              <Text
                style={[
                  type.sectionLabel,
                  {
                    paddingHorizontal: spacing.sm,
                    marginBottom: 4,
                    color: colors.textTertiary,
                  },
                ]}
              >
                {section}
              </Text>
              {NAV.filter((n) => n.section === section).map((item) => {
                const on = item.id === nav;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setNav(item.id)}
                    style={[
                      styles.navItem,
                      on && { backgroundColor: colors.bgSidebarActive },
                    ]}
                  >
                    <View style={styles.navRow}>
                      <Text
                        style={[
                          type.callout,
                          {
                            color: on ? colors.accentBlue : colors.textSecondary,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.badge ? (
                        <View
                          style={[styles.navBadge, { backgroundColor: colors.accentBlue }]}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={[styles.pane, { backgroundColor: colors.bgPage }]}>
          <View
            style={[
              styles.paneHeader,
              { borderBottomColor: colors.borderSubtle },
            ]}
          >
            <Text style={[type.title2, { color: colors.textPrimary }]}>{title}</Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: colors.bgMuted }]}
              accessibilityLabel="Close settings"
            >
              <Text style={[styles.closeGlyph, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.paneScroll}
            contentContainerStyle={styles.paneContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  modal: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 860,
    height: "100%",
    maxHeight: 640,
    borderRadius: radius.modal,
    overflow: "hidden",
    zIndex: 2,
    elevation: 8,
  },
  rail: {
    width: 200,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  sectionBlock: { marginBottom: spacing.md },
  navItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 2,
  },
  navRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  navBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pane: { flex: 1, minWidth: 0 },
  paneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { fontSize: 14, fontWeight: "600" },
  paneScroll: { flex: 1 },
  paneContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    maxWidth: layout.maxContentWidth,
  },
});
