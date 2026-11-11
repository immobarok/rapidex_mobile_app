import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={style.container}>
      <Text style={style.title}>
        Hello I am a react native developer
      </Text>
    </View>
  )
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#000000',
  }
})
