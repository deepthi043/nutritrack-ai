import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { useAuth } from "../providers/AuthProvider";
import { LoadingState } from "../components/LoadingState";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { HomeScreen } from "./HomeScreen";
import { ActivityScreen } from "./ActivityScreen";
import { HydrationScreen } from "./HydrationScreen";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Activity: undefined;
  Hydration: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTabs = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#059669",
        tabBarInactiveTintColor: "#94a3b8",
      }}
    >
      <MainTabs.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text> }}
      />
      <MainTabs.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👣</Text> }}
      />
      <MainTabs.Screen
        name="Hydration"
        component={HydrationScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>💧</Text> }}
      />
    </MainTabs.Navigator>
  );
}

/** Root navigator: protected routes are simply "not reachable while
 * logged out" — the whole main tab tree only mounts once isAuthenticated
 * is true (section 3's "protected mobile routes"). */
export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingState message="Loading..." />;

  return <NavigationContainer>{isAuthenticated ? <MainNavigator /> : <AuthNavigator />}</NavigationContainer>;
}
