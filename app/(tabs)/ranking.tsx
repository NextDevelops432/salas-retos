import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, DashboardHeader, EmptyState, IconBadge } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';

interface RoomOption {
  id: string;
  name: string;
}

interface RankRow {
  userId: string;
  username: string;
  pointsEarned: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingScreen() {
  const { session, profile } = useAuth();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('room_members')
      .select('room:rooms(id, name)')
      .eq('user_id', session.user.id);
    const roomsData = (data ?? []).map((m: any) => m.room).filter(Boolean) as RoomOption[];
    setRooms(roomsData);
    setSelectedRoom((prev) => prev ?? roomsData[0]?.id ?? null);
    if (roomsData.length === 0) setLoading(false);
  }, [session]);

  const loadRanking = useCallback(async (roomId: string) => {
    setLoading(true);
    const { data: points } = await supabase
      .from('room_member_points')
      .select('user_id, points_earned')
      .eq('room_id', roomId);

    const userIds = (points ?? []).map((p: any) => p.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, username').in('id', userIds)
      : { data: [] as any[] };
    const usernameById = new Map((profiles ?? []).map((p: any) => [p.id, p.username]));

    setRows(
      (points ?? [])
        .map((p: any) => ({
          userId: p.user_id,
          username: usernameById.get(p.user_id) ?? 'Usuario',
          pointsEarned: p.points_earned,
        }))
        .sort((a: RankRow, b: RankRow) => b.pointsEarned - a.pointsEarned)
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms])
  );

  useEffect(() => {
    if (selectedRoom) loadRanking(selectedRoom);
  }, [selectedRoom, loadRanking]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DashboardHeader greeting="Ranking" subtitle="¿Quién va ganando en cada sala?" username={profile?.username} />

      {rooms.length === 0 ? (
        <EmptyState title="Todavía no estás en ninguna sala" />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {rooms.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.chip, selectedRoom === r.id && styles.chipActive]}
                onPress={() => setSelectedRoom(r.id)}
              >
                <Text style={[styles.chipText, selectedRoom === r.id && styles.chipTextActive]}>{r.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ height: spacing.md }} />

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Card>
              {rows.map((row, i) => (
                <View key={row.userId} style={[styles.rankRow, i > 0 && styles.rankRowBorder]}>
                  <Text style={styles.rankPosition}>{MEDALS[i] ?? `#${i + 1}`}</Text>
                  <IconBadge seed={row.userId} emoji="👤" size={36} />
                  <Text style={styles.rankName}>
                    {row.username}
                    {row.userId === session?.user.id ? ' (tú)' : ''}
                  </Text>
                  <Text style={styles.rankPoints}>⭐ {row.pointsEarned}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chipsRow: { gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.textOnPrimary },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rankRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rankPosition: { width: 28, fontSize: 16, textAlign: 'center' },
  rankName: { flex: 1, color: colors.text, fontWeight: '700', fontSize: 14 },
  rankPoints: { color: colors.points, fontWeight: '800', fontSize: 14 },
});
