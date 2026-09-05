import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, fontFamily, layout, radius, shadow, spacing, type } from "../theme";
import { useIsDesktopWeb } from "./useIsDesktopWeb";

export type SettingsNavId =
  | "general"
  | "account"
  | "subscription"
  | "banks"
  | "fx"
  | "about";

const NAV: { id: SettingsNavId; label: string; section: string }[] = [
  { id: "general", label: "General", section: "SETTINGS" },
  { id: "account", label: "Account", section: "SETTINGS" },
  { id: "subscription", label: "Subscription", section: "SETTINGS" },
  { id: "banks", label: "Banks", section: "CONNECTIONS" },
  { id: "fx", label: "FX & Import", section: "CONNECTIONS" },
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
    <View style={styles.scrim} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={styles.modal}>
        <View style={styles.rail}>
          <Text style={styles.brand}>Settings</Text>
          {sections.map((section) => (
            <View key={section} style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>{section}</Text>
              {NAV.filter((n) => n.section === section).map((item) => {
                const on = item.id === nav;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setNav(item.id)}
                    style={[styles.navItem, on && styles.navItemOn]}
                  >
                    <Text style={[styles.navText, on && styles.navTextOn]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.pane}>
          <View style={styles.paneHeader}>
            <Text style={styles.paneTitle}>{title}</Text>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityLabel="Close settings"
            >
              <Text style={styles.closeGlyph}>✕</Text>
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
    backgroundColor: colors.bgModalScrim,
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
    backgroundColor: colors.bgElevated,
    borderRadius: radius.modal,
    overflow: "hidden",
    ...shadow.modal,
  },
  rail: {
    width: 200,
    backgroundColor: colors.bgPage,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.borderSubtle,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    ...type.title3,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
    fontFamily,
  },
  sectionBlock: { marginBottom: spacing.md },
  sectionLabel: {
    ...type.sectionLabel,
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  navItem: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    marginBottom: 2,
  },
  navItemOn: { backgroundColor: colors.bgSidebarActive },
  navText: { ...type.callout, color: colors.textSecondary, fontWeight: "600" },
  navTextOn: { color: colors.accentBlue },
  pane: { flex: 1, minWidth: 0, backgroundColor: colors.bgPage },
  paneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  paneTitle: { ...type.title2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeGlyph: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
  paneScroll: { flex: 1 },
  paneContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    maxWidth: layout.maxContentWidth,
  },
});
