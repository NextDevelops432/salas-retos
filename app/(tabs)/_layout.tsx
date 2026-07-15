import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { MobileTabBar, Sidebar } from '../../components/Sidebar';
import { colors } from '../../constants/theme';
import { useIsWideScreen } from '../../lib/useIsWideScreen';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const isWide = useIsWideScreen();

  return (
    <Tabs
      tabBar={(props) => (isWide ? <Sidebar {...(props as any)} /> : <MobileTabBar {...(props as any)} />)}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mis Salas',
          tabBarLabel: 'Inicio',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarLabel: 'Historial',
          tabBarIcon: () => <TabIcon emoji="🗂️" />,
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: 'Ranking',
          tabBarLabel: 'Ranking',
          tabBarIcon: () => <TabIcon emoji="🏅" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mi Perfil',
          tabBarLabel: 'Perfil',
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}
