import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing } from '../constants/theme';

const COLLAPSE_KEY = 'retame:sidebarCollapsed';
const EXPANDED_WIDTH = 224;
const COLLAPSED_WIDTH = 76;

interface TabRoute {
  key: string;
  name: string;
}

interface TabDescriptor {
  options: {
    title?: string;
    tabBarLabel?: string;
    tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
  };
}

export interface SidebarBarProps {
  state: { routes: TabRoute[]; index: number };
  descriptors: Record<string, TabDescriptor>;
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: string; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
}

function navLabel(options: TabDescriptor['options']): string {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  return options.title ?? '';
}

export function Sidebar({ state, descriptors, navigation }: SidebarBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSE_KEY).then((v) => {
      setCollapsed(v === '1');
      setLoaded(true);
    });
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    AsyncStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
  };

  if (!loaded) return <View style={{ width: COLLAPSED_WIDTH, backgroundColor: colors.surface }} />;

  return (
    <View style={[styles.container, { width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }]}>
      <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
        {!collapsed ? (
          <View style={styles.brand}>
            <Text style={{ fontSize: 20 }}>🏆</Text>
            <Text style={styles.brandText}>RetaMe</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 20 }}>🏆</Text>
        )}
      </View>

      <Pressable onPress={toggle} style={[styles.toggleBtn, collapsed && styles.toggleBtnCollapsed]}>
        <Text style={styles.toggleIcon}>{collapsed ? '»' : '«'}</Text>
        {!collapsed ? <Text style={styles.toggleLabel}>Contraer</Text> : null}
      </Pressable>

      <View style={{ height: spacing.sm }} />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = navLabel(options);

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[styles.item, focused && styles.itemActive, collapsed && styles.itemCollapsed]}
          >
            {options.tabBarIcon?.({ focused, color: focused ? colors.primary : colors.textMuted, size: 20 })}
            {!collapsed ? (
              <Text style={[styles.itemLabel, focused && styles.itemLabelActive]} numberOfLines={1}>
                {label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  brandRow: { paddingHorizontal: spacing.sm, marginBottom: spacing.sm },
  brandRowCollapsed: { alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontSize: 17, fontWeight: '800', color: colors.text },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  toggleBtnCollapsed: { justifyContent: 'center' },
  toggleIcon: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  toggleLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginVertical: 2,
  },
  itemCollapsed: { justifyContent: 'center' },
  itemActive: { backgroundColor: colors.surfaceAlt },
  itemLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  itemLabelActive: { color: colors.primary },
});

export function MobileTabBar({ state, descriptors, navigation }: SidebarBarProps) {
  return (
    <View style={mobileStyles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = navLabel(options);

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable key={route.key} onPress={onPress} style={mobileStyles.item}>
            {options.tabBarIcon?.({ focused, color: focused ? colors.primary : colors.textMuted, size: 20 })}
            <Text style={[mobileStyles.label, focused && mobileStyles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const mobileStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingBottom: 10,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: colors.textMuted, fontWeight: '700', fontSize: 11 },
  labelActive: { color: colors.primary },
});
