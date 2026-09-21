import { useState } from "react";
import { Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useAuth } from "../providers/AuthProvider";
import type { AuthStackParamList } from "./navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoGlyph}>🌿</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to NutriTrack AI</Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonSpacing}>
            <Button label="Log in" onPress={handleSubmit} isLoading={isSubmitting} />
          </View>
        </Card>

        <Text style={styles.link} onPress={() => navigation.navigate("Signup")}>
          Don&apos;t have an account? <Text style={styles.linkAccent}>Sign up</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 4 },
  logo: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoGlyph: { fontSize: 22 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20 },
  card: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#0f172a", marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: "#fff",
    marginTop: 6,
  },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 10 },
  buttonSpacing: { marginTop: 14 },
  link: { textAlign: "center", marginTop: 20, color: "#64748b", fontSize: 14 },
  linkAccent: { color: "#059669", fontWeight: "600" },
});
