import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FAB,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import EmptyState from '../../components/ui/EmptyState';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  RoomType,
  RoomTypeStats,
  deleteRoomType,
  getRoomTypeStats,
  getRoomTypes,
} from '../../api/room-types';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'RoomTypeList'>;

export default function RoomTypeListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [types, setTypes] = useState<RoomType[]>([]);
  const [stats, setStats] = useState<RoomTypeStats>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [t, s] = await Promise.all([
        getRoomTypes(true),
        getRoomTypeStats().catch(() => ({})),
      ]);
      setTypes(t);
      setStats(s);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [load, navigation]);

  const handleDelete = (rt: RoomType) => {
    Alert.alert(
      'Деактивировать тип?',
      `"${rt.name}" будет скрыт. Тип нельзя удалить, пока он используется активными комнатами.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Деактивировать',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoomType(rt.id);
              await load();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message || 'Не удалось');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: RoomType }) => {
    const counts = stats[item.id] ?? { active: 0, inactive: 0 };
    return (
      <Card
        mode="outlined"
        style={[styles.card, !item.isActive && { opacity: 0.55 }]}
        onPress={() =>
          navigation.navigate('RoomTypeForm', { roomTypeId: item.id })
        }
      >
        {item.coverPhoto ? (
          <Image source={{ uri: item.coverPhoto }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="labelLarge" style={{ opacity: 0.5 }}>
              Нет обложки
            </Text>
          </View>
        )}
        <Card.Title
          title={item.name}
          subtitle={`${item.code} · до ${item.maxGuests} гостей · ${item.basePrice}/сут`}
          right={(props) => (
            <View style={styles.row}>
              <IconButton
                {...props}
                icon="pencil"
                onPress={() =>
                  navigation.navigate('RoomTypeForm', { roomTypeId: item.id })
                }
              />
              {item.isActive && (
                <IconButton
                  {...props}
                  icon="archive"
                  onPress={() => handleDelete(item)}
                />
              )}
            </View>
          )}
        />
        <Card.Content>
          {item.description && (
            <Text variant="bodySmall" numberOfLines={2} style={styles.desc}>
              {item.description}
            </Text>
          )}
          <View style={styles.chipRow}>
            <Chip compact icon="bed">{item.beds} {item.bedConfiguration ? `(${item.bedConfiguration})` : ''}</Chip>
            {item.sizeM2 && <Chip compact>{item.sizeM2} m²</Chip>}
            {item.view && <Chip compact>{item.view}</Chip>}
            {item.breakfastIncluded && <Chip compact icon="silverware-fork-knife">Завтрак</Chip>}
            {item.amenities.slice(0, 4).map((a) => (
              <Chip key={a} compact>{a}</Chip>
            ))}
            {item.amenities.length > 4 && (
              <Chip compact>+{item.amenities.length - 4}</Chip>
            )}
            {!item.isActive && (
              <Chip compact icon="archive" style={styles.inactiveChip}>
                Неактивен
              </Chip>
            )}
          </View>
        </Card.Content>
        <Card.Actions>
          <Text variant="labelSmall" style={styles.counts}>
            {counts.active} комн.{counts.inactive > 0 && ` (+${counts.inactive} неактивных)`}
          </Text>
          <Button
            compact
            icon="plus"
            onPress={() =>
              navigation.navigate('RoomForm', { roomTypeId: item.id })
            }
          >
            Добавить комнаты
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  if (loading) {
    return <ScreenContainer maxWidth="grid" loading skeletonCount={3} />;
  }

  return (
    <ScreenContainer maxWidth="grid">
      <FlatList
        data={types}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="bed-outline"
            title="Нет типов комнат"
            actionLabel="Создать первый"
          />
        }
      />
      <FAB
        icon="plus"
        label="Новый тип"
        style={styles.fab}
        onPress={() => navigation.navigate('RoomTypeForm', {})}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, paddingBottom: 96 },
  card: { marginBottom: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 160 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  desc: { marginBottom: 8, opacity: 0.85 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  counts: { marginLeft: 12, opacity: 0.7 },
  inactiveChip: {},
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
