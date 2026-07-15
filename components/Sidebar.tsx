import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow, spacing } from '../constants/theme';

const COLLAPSE_KEY = 'retame:sidebarCollapsed';
const EXPANDED_WIDTH = 224;
const COLLAPSED_WIDTH = 76;

const NAV_ITEMS: { path: '/' | '/historial' | '/ranking' | '/profile'; label: string; emoji: string }[] = [
  { path: '/', label: 'Inicio', emoji: '🏠' },
  { path: '/historial', label: 'Historial', emoji: '🗂️' },
  { path: '/ranking', label: 'Ranking', emoji: '🏅' },
  { path: '/profile', label: 'Perfil', emoji: '👤' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

      {NAV_ITEMS.map((item) => {
        const focused = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);

        return (
          <Pressable
            key={item.path}
            onPress={() => router.push(item.path as any)}
            style={[styles.item, focused && styles.itemActive, collapsed && styles.itemCollapsed]}
          >
            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
            {!collapsed ? (
              <Text style={[styles.itemLabel, focused && styles.itemLabelActive]} numberOfLines={1}>
                {item.label}
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
    height: '100%',
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

function TabItem({ route, index, state, descriptors, navigation }: any) {
  const { options } = descriptors[route.key];
  const focused = state.index === index;
  const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? '';

  const onPress = () => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <Pressable onPress={onPress} style={mobileStyles.item}>
      {options.tabBarIcon?.({ focused, color: focused ? colors.primary : colors.textMuted, size: 20 })}
      <Text style={[mobileStyles.label, focused && mobileStyles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MobileTabBar({ state, descriptors, navigation }: any) {
  const router = useRouter();
  const routes = state.routes as any[];
  const firstHalf = routes.slice(0, 2);
  const secondHalf = routes.slice(2);

  return (
    <View style={mobileStyles.wrap}>
      <View style={mobileStyles.container}>
        {firstHalf.map((route, i) => (
          <TabItem key={route.key} route={route} index={i} state={state} descriptors={descriptors} navigation={navigation} />
        ))}

        <View style={mobileStyles.fabSlot}>
          <Pressable style={mobileStyles.fab} onPress={() => router.push('/room/new')}>
            <Text style={mobileStyles.fabIcon}>+</Text>
          </Pressable>
        </View>

        {secondHalf.map((route, i) => (
          <TabItem
            key={route.key}
            route={route}
            index={i + 2}
            state={state}
            descriptors={descriptors}
            navigation={navigation}
          />
        ))}
      </View>
    </View>
  );
}

const mobileStyles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    height: 64,
    ...shadow,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: colors.textMuted, fontWeight: '700', fontSize: 11 },
  labelActive: { color: colors.primary },
  fabSlot: { width: 56, alignItems: 'center', justifyContent: 'center' },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    ...shadow,
  },
  fabIcon: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginTop: -2 },
});
