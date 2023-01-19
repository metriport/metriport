import React, { useState } from "react";
import { Modal, StyleSheet, Text, Pressable, View } from "react-native";
import { WebView } from "react-native-webview";

const App = () => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.centeredView}>
      <Modal
        animationType='slide'
        presentationStyle='formSheet'
        visible={modalVisible}
      >
        <Pressable
          style={{ backgroundColor: "#748df0", height: 40, alignItems: "center", justifyContent: 'center' }}
          onPress={() => setModalVisible(false)}
        >
          <Text style={styles.textStyle}>CLOSE</Text>
        </Pressable>
        <WebView
          source={{ uri: "https://connect.metriport.com/?token=demo" }}
        />
      </Modal>
      <Pressable
        style={[styles.button, styles.buttonOpen]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.textStyle}>Show Metriport Widget</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  buttonOpen: {
    backgroundColor: "#748df0"
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
