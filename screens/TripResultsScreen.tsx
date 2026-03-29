import { StyleSheet, Text, View } from 'react-native';

export default function TripResultsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Trip results</Text>
      <Text style={styles.hint}>Placeholder — results will show here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  hint: {
    fontSize: 15,
    color: '#6B6965',
    textAlign: 'center',
  },
});
