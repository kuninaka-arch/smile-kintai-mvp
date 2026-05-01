"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("employee@smile-kintai.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) router.push("/post-login");
    else setError("メールアドレスまたはパスワードが違います。");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-3xl text-white">☺</div>
          <h1 className="text-3xl font-black text-blue-700">勤怠管理システム</h1>
          <p className="mt-2 text-sm text-slate-500">中小企業向け勤怠管理アプリ</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <label className="block">
            <span className="text-sm font-bold">メールアドレス</span>
            <input className="mt-2 w-full rounded-xl border px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-bold">パスワード</span>
            <input className="mt-2 w-full rounded-xl border px-4 py-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
          <button className="btn w-full bg-blue-600 text-white" type="submit">ログイン</button>
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            管理者: admin@smile-kintai.local / password123<br />
            社員: employee@smile-kintai.local / password123
          </div>
        </form>
      </div>
    </main>
  );
}
