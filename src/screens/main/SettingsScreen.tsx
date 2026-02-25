import React from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import {Text, Button, Divider, useTheme} from 'react-native-paper';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {useAuth} from '../../context/AuthContext';

function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();
  const {signOut} = useAuth();

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            await GoogleSignin.signOut();
          } catch {
            // Google 로그아웃 실패 시 무시
          }
          signOut();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Text
        variant="headlineMedium"
        style={[styles.title, {color: theme.colors.onBackground}]}>
        설정
      </Text>
      <Divider style={styles.divider} />
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          textColor={theme.colors.error}
          style={[styles.logoutButton, {borderColor: theme.colors.error}]}>
          로그아웃
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  title: {
    marginBottom: 16,
  },
  divider: {
    marginBottom: 16,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  logoutButton: {
    borderRadius: 8,
  },
});

export default SettingsScreen;
