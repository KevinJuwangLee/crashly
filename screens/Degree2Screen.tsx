import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Degree2Screen() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner}>
        <Text style={styles.title}>Degree 2</Text>
        <Text style={styles.hint}>Placeholder — extended network search coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2C2C2A',
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    color: '#6B6965',
    lineHeight: 22,
  },
});
