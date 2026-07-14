import { Button } from "@/components/ui/button";

interface GoogleSignInProps {
  redirectTo?: string;
}

export function GoogleSignIn({ redirectTo = "/dashboard" }: GoogleSignInProps) {
  const href = `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <>
      <Button asChild type="button" variant="outline" className="w-full h-10">
        <a href={href}>
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full border text-xs font-bold text-blue-600"
          >
            G
          </span>
          Continue with Google
        </a>
      </Button>
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
