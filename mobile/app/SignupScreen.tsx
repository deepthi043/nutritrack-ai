import { useState } from "react";
import { Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useAuth } from "../providers/AuthProvider";
import { validateSignupForm } from "./validateSignupForm";
import type { AuthStackParamList } from "./navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Signup">;

export function SignupScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    const validationError = validateSignupForm(fullName, email, password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      await register(email, password, fullName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign up");
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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start tracking your wellness journey</Text>

        <Card style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Jane Doe"
            placeholderTextColor="#94a3b8"
            value={fullName}
            onChangeText={setFullName}
          />

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
            placeholder="At least 8 characters"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.helper}>Use at least 8 characters.</Text>

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonSpacing}>
            <Button label="Create account" onPress={handleSubmit} isLoading={isSubmitting} />
          </View>
        </Card>

        <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
          Already have an account? <Text style={styles.linkAccent}>Log in</Text>
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
  helper: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  error: { color: "#b91c1c", fontSize: 13, marginTop: 10 },
  buttonSpacing: { marginTop: 14 },
  link: { textAlign: "center", marginTop: 20, color: "#64748b", fontSize: 14 },
  linkAccent: { color: "#059669", fontWeight: "600" },
});
