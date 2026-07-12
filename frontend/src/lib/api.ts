import { useSession } from "@/stores/session";
import type { SessionUser } from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3101";

/** Protótipo estático (GitHub Pages): backend simulado no navegador. */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
}

interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

/** Renova a sessão via cookie httpOnly. Retorna false se não há sessão válida. */
export async function tryRefreshSession(): Promise<boolean> {
  if (IS_DEMO) {
    const { demoSession } = await import("@/lib/demo/demo-backend");
    const user = demoSession();
    if (!user) return false;
    useSession.getState().setSession(user, "demo-token");
    return true;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SessionResponse;
    useSession.getState().setSession(data.user, data.accessToken);
    return true;
  } catch {
    return false;
  }
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const { accessToken } = useSession.getState();
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  return fetch(`${BASE_URL}/api${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body:
      options.formData ??
      (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
}

async function demoRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { demoApi, demoAttachReceipt, demoSetAvatar, DemoApiError } = await import(
    "@/lib/demo/demo-backend"
  );
  try {
    const receiptMatch = /^\/purchases\/([^/]+)\/receipt$/.exec(path.split("?")[0]);
    if (receiptMatch && options.formData) {
      const file = options.formData.get("file");
      if (!(file instanceof File)) throw new ApiError(422, "Arquivo inválido.");
      return (await demoAttachReceipt(receiptMatch[1], file)) as T;
    }
    if (path.split("?")[0] === "/users/me/avatar" && options.formData) {
      const file = options.formData.get("file");
      if (!(file instanceof File)) throw new ApiError(422, "Arquivo inválido.");
      return (await demoSetAvatar(file)) as T;
    }
    return demoApi(path, options.method ?? "GET", options.body) as T;
  } catch (err) {
    if (err instanceof DemoApiError) {
      if (err.status === 401) useSession.getState().clearSession();
      throw new ApiError(err.status, err.message);
    }
    throw err;
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (IS_DEMO) return demoRequest<T>(path, options);

  let res = await rawRequest(path, options);

  if (res.status === 401) {
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      useSession.getState().clearSession();
      throw new ApiError(401, "Sessão expirada. Faça login novamente.");
    }
    res = await rawRequest(path, options);
  }

  if (!res.ok) {
    let message = "Ocorreu um erro inesperado.";
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join("; ");
      else if (body.message) message = body.message;
    } catch {
      // corpo não-JSON — mantém mensagem genérica
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<void> {
  if (IS_DEMO) {
    const { demoLogin, DemoApiError } = await import("@/lib/demo/demo-backend");
    try {
      const user = demoLogin(email, password);
      useSession.getState().setSession(user, "demo-token");
      return;
    } catch (err) {
      if (err instanceof DemoApiError) throw new ApiError(err.status, err.message);
      throw err;
    }
  }
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? "Credenciais inválidas.");
  }
  const data = (await res.json()) as SessionResponse;
  useSession.getState().setSession(data.user, data.accessToken);
}

export async function logout(): Promise<void> {
  if (IS_DEMO) {
    const { demoLogout } = await import("@/lib/demo/demo-backend");
    demoLogout();
    useSession.getState().clearSession();
    return;
  }
  await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
  useSession.getState().clearSession();
}

/** Baixa um arquivo autenticado (ex.: export XLSX/PDF) e dispara o download no navegador. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  if (IS_DEMO) {
    throw new ApiError(501, "Exportação não disponível no protótipo.");
  }

  let res = await rawRequest(path, {});
  if (res.status === 401) {
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      useSession.getState().clearSession();
      throw new ApiError(401, "Sessão expirada. Faça login novamente.");
    }
    res = await rawRequest(path, {});
  }
  if (!res.ok) {
    throw new ApiError(res.status, "Não foi possível gerar o arquivo.");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Resolve a URL da foto de perfil de um usuário (real ou demo). */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  if (IS_DEMO) {
    const { demoAvatarUrl } = await import("@/lib/demo/demo-backend");
    return demoAvatarUrl(userId);
  }
  const { accessToken } = useSession.getState();
  const res = await fetch(`${BASE_URL}/api/users/${userId}/avatar`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: "include",
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/** Resolve a URL do comprovante para abrir em nova aba (real ou demo). */
export async function getReceiptUrl(purchaseId: string): Promise<string | null> {
  if (IS_DEMO) {
    const { demoReceiptUrl } = await import("@/lib/demo/demo-backend");
    return demoReceiptUrl(purchaseId);
  }
  const { accessToken } = useSession.getState();
  const res = await fetch(`${BASE_URL}/api/purchases/${purchaseId}/receipt`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: "include",
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}
