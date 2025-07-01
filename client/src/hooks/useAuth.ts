import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
}

interface AuthResponse {
  authenticated: boolean;
  user?: User;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: authData, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/status"],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      return await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/logout", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  return {
    user: authData?.user,
    isAuthenticated: authData?.authenticated || false,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
  };
}