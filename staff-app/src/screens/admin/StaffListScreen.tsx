import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import {
  Button,
  Card,
  Dialog,
  FAB,
  Portal,
  Searchbar,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';
import { deleteUser, getUsers, updateUser } from '../../api/users';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { semantic } from '../../theme/colors';

type Props = NativeStackScreenProps<AdminStackParamList, 'StaffList'>;

export default function StaffListScreen({ navigation }: Props) {
  const theme = useTheme();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsers(includeInactive);
      setUsers(data);
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить сотрудников');
    } finally {
      setLoading(false);
    }
  }, [includeInactive, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUsers();
    });
    return unsubscribe;
  }, [navigation, fetchUsers]);

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      setDeleteDialogVisible(false);
      setUserToDelete(null);
      fetchUsers();
      toast.success('Сотрудник деактивирован');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось удалить пользователя');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Re-activate a soft-deleted user. The backend soft-deletes by setting
   * isActive=false; flipping it back restores access without touching
   * anything else (role, password, outlets are all preserved).
   */
  const handleRestore = async (user: any) => {
    try {
      await updateUser(user.id, { isActive: true });
      toast.success(`${user.fullName || user.username} восстановлен`);
      fetchUsers();
    } catch (e: any) {
      toast.error('Не удалось восстановить', e?.message);
    }
  };

  const filtered = users.filter((u: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const fullName = (u.fullName || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    return fullName.includes(q) || username.includes(q);
  });

  const formatLastLogin = (iso?: string | null) => {
    if (!iso) return 'не входил';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'не входил';
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderUser = ({ item }: { item: any }) => {
    const roleName = typeof item.role === 'object' ? item.role?.name : item.role;
    const lockedUntil = item.lockedUntil ? new Date(item.lockedUntil) : null;
    const isLocked = !!lockedUntil && lockedUntil.getTime() > Date.now();
    const failed = Number(item.failedLoginAttempts || 0);

    return (
      <Card
        style={styles.card}
        onPress={() => navigation.navigate('StaffForm', { userId: item.id })}
        onLongPress={() => {
          setUserToDelete(item);
          setDeleteDialogVisible(true);
        }}
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              <Text variant="titleMedium" style={styles.userName}>
                {item.fullName || item.username}
              </Text>
              <Text variant="bodySmall" style={styles.username}>
                @{item.username}
              </Text>
              <Text variant="labelSmall" style={styles.lastLogin}>
                Вход: {formatLastLogin(item.lastLoginAt)}
                {item.lastLoginIp ? ` · ${item.lastLoginIp}` : ''}
              </Text>
            </View>
            <View style={styles.cardRight}>
              <StatusBadge status={roleName || 'N/A'} domain="role" />
              {item.isActive === false && (
                <>
                  <Text variant="labelSmall" style={styles.inactiveLabel}>
                    Неактивен
                  </Text>
                  <Button
                    compact
                    mode="text"
                    onPress={() => handleRestore(item)}
                    style={styles.restoreBtn}
                  >
                    Восстановить
                  </Button>
                </>
              )}
              {isLocked && (
                <Text variant="labelSmall" style={styles.lockedLabel}>
                  🔒 до {lockedUntil!.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              {!isLocked && failed > 0 && (
                <Text variant="labelSmall" style={styles.failedLabel}>
                  Неудачных входов: {failed}
                </Text>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Поиск по имени"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchbar}
      />

      <View style={styles.toggleRow}>
        <Text variant="bodyMedium">Показать неактивных</Text>
        <Switch value={includeInactive} onValueChange={setIncludeInactive} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchUsers} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="account-group-outline" title="Нет сотрудников" />
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('StaffForm', {})}
      />

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Удалить сотрудника</Dialog.Title>
          <Dialog.Content>
            <Text>
              Удалить пользователя {userToDelete?.fullName || userToDelete?.username}?
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Отмена</Button>
            <Button
              onPress={handleDeleteConfirm}
              loading={deleting}
              textColor={semantic.error}
            >
              Удалить
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12, marginBottom: 0 },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontWeight: 'bold' },
  username: { opacity: 0.5, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  inactiveLabel: {
    color: semantic.error,
    marginTop: 4,
  },
  lastLogin: { opacity: 0.45, marginTop: 4 },
  lockedLabel: { color: semantic.error, marginTop: 4, fontWeight: '600' },
  failedLabel: { color: semantic.warning, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 28,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  restoreBtn: { marginTop: 2 },
});
