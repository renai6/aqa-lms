import { LoginForm } from "./login-form";

type Props = { searchParams: Promise<{ courseId?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { courseId } = await searchParams;
  return <LoginForm courseId={courseId} />;
}
